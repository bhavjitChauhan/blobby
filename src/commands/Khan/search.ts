import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { aggregate, Collections } from '../../lib/mongodb/mongodb'
import { EmbedLimits, PaginatedMessage } from '@sapphire/discord.js-utilities'
import { MessageEmbed } from 'discord.js'
import config from '../../config'
import { BULLET_SEPARATOR, EN_SPACE_CHAR } from '../../lib/constants'
import { displayName, profileURL, sortScratchpadsByDate } from '../../lib/utils/khan'
import type { AuthorDocument, ScratchpadDocument } from '../../lib/mongodb/types'
import { rank, truncate } from '../../lib/utils/general'
import { hyperlink, inlineCode, time } from '@discordjs/builders'
import { Stopwatch } from '@sapphire/stopwatch'
import { formatStopwatch } from '../../lib/utils/discord'
import { profanity } from '@2toad/profanity'

@ApplyOptions<Subcommand.Options>({
  description: 'Search for a Khan Academy user or program',
  preconditions: ['UserRateLimit'],
  subcommands: [
    {
      name: 'code',
      chatInputRun: 'chatInputCode',
    },
    {
      name: 'user',
      chatInputRun: 'chatInputUser',
    },
  ],
})
export class UserCommand extends Subcommand {
  readonly #INAPPROPRIATE_QUERY = "I can't search for that"
  readonly #QUERY_TIMEOUT = 'The search took too long'
  readonly #CODE_NOT_FOUND = "I couldn't find any programs with that code"
  readonly #USER_NOT_FOUND = "I couldn't find any users with that name"

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('code')
              .setDescription('Search for a Khan Academy program')
              .addStringOption((option) =>
                option //
                  .setName('query')
                  .setDescription('Full-text query for program code')
                  .setRequired(true)
              )
              .addStringOption((option) =>
                option //
                  .setName('sort')
                  .setDescription('What to sort results by')
                  .addChoices(
                    {
                      name: 'Votes',
                      value: 'votes',
                    },
                    {
                      name: 'Spin-Offs',
                      value: 'forks',
                    },
                    {
                      name: 'Oldest',
                      value: 'oldest',
                    },
                    {
                      name: 'Newest',
                      value: 'newest',
                    }
                  )
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('user')
              .setDescription('Search for a Khan Academy user')
              .addStringOption((option) =>
                option //
                  .setName('query')
                  .setDescription('Full-text query for Khan Academy nickname or username')
                  .setRequired(true)
              )
              .addStringOption((option) =>
                option //
                  .setName('sort')
                  .setDescription('What to sort results by')
                  .addChoices(
                    {
                      name: 'Votes',
                      value: 'votes',
                    },
                    {
                      name: 'Spin-Offs',
                      value: 'forks',
                    },
                    {
                      name: 'Programs',
                      value: 'programs',
                    },
                    {
                      name: 'Questions',
                      value: 'questions',
                    },
                    {
                      name: 'Answers',
                      value: 'answers',
                    },
                    {
                      name: 'Tips & Thanks',
                      value: 'Comments',
                    },
                    {
                      name: 'Replies',
                      value: 'replies',
                    },
                    {
                      name: 'Help Requests',
                      value: 'projectquestions',
                    },
                    {
                      name: 'Help Replies',
                      value: 'projectanswers',
                    }
                  )
              )
          ),
      { idHints: ['1015062111354892429', '1020204330307047474'] }
    )
  }

  private pipelineCode(query: string, sort: CodeSortOptions) {
    const sortStage = {
      $sort: {
        [sort === 'oldest' || sort === 'newest' ? 'created' : sort]: sort === 'oldest' ? 1 : -1,
      },
    }
    return [
      {
        $match: {
          votes: {
            $gte: 10,
          },
          $text: {
            $search: query,
          },
        },
      },
      sortStage,
      {
        $limit: config.search.resultsPerPage * 25,
      },
      {
        $lookup: {
          from: 'authors',
          let: {
            authorID: '$authorID',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$authorID', '$$authorID'],
                },
              },
            },
            {
              $project: {
                username: 1,
                nickname: 1,
              },
            },
          ],
          as: 'author',
        },
      },
      {
        $addFields: {
          author: {
            $first: '$author',
          },
        },
      },
      {
        $project: {
          code: 0,
        },
      },
    ]
  }

  private rankScratchpads(scratchpads: ScratchpadDocument[], sort: CodeSortOptions) {
    switch (sort) {
      case 'votes':
        rank(scratchpads, '-votes', '-forks')
        break
      case 'forks':
        rank(scratchpads, '-forks', '-votes')
        break
      case 'oldest':
        rank(scratchpads, '-votes', '-forks')
        sortScratchpadsByDate(scratchpads, 'created', 'updated')
        break
      case 'newest':
        rank(scratchpads, '-votes', '-forks')
        sortScratchpadsByDate(scratchpads, 'created', 'updated', false)
        break
    }
  }

  private paginatedMessageCode(query: string, scratchpads: ScratchpadDocument[], sort: CodeSortOptions, stopwatch: Stopwatch) {
    const paginatedMessage = new PaginatedMessage({
      template: new MessageEmbed() //
        .setColor('GREEN')
        .setFooter({
          text: formatStopwatch(stopwatch),
        }),
    })

    for (let i = 0; i < scratchpads.length; i += config.search.resultsPerPage) {
      paginatedMessage.addPageEmbed((embed) =>
        embed //
          .setTitle(
            `${scratchpads.length === config.search.resultsPerPage * 25 ? scratchpads.length + '+' : scratchpads.length} results for ${inlineCode(
              query
            )}`
          )
          .addFields(
            scratchpads //
              .slice(i, i + config.search.resultsPerPage)
              .map((scratchpad) => {
                let valueArr: string[]
                if (sort === 'oldest' || sort === 'newest') valueArr = [time(scratchpad.created, 'R')]
                else if (sort === 'votes') valueArr = [`${scratchpad.votes} votes`, `${scratchpad.forks} spin-offs`]
                else valueArr = [`${scratchpad.forks} spin-offs`, `${scratchpad.votes} votes`]
                return {
                  name: scratchpad.title ? truncate(scratchpad.title, EmbedLimits.MaximumFieldNameLength) : 'Untitled',
                  value:
                    hyperlink('🔗', `https://www.khanacademy.org/computer-programming/-/${scratchpad.scratchpadID}`) +
                    EN_SPACE_CHAR +
                    valueArr.join(BULLET_SEPARATOR),
                }
              })
          )
      )
    }

    return paginatedMessage
  }

  public async chatInputCode(interaction: Subcommand.ChatInputInteraction) {
    await interaction.deferReply()

    const stopwatch = new Stopwatch()

    const query = interaction.options.getString('query', true),
      sort = (interaction.options.getString('sort') ?? 'votes') as CodeSortOptions
    if (profanity.exists(query)) return interaction.editReply(this.#INAPPROPRIATE_QUERY)

    const scratchpads = (await aggregate(Collections.Scratchpads, this.pipelineCode(query, sort))) as ScratchpadDocument[] | null
    if (scratchpads === null) return interaction.editReply(this.#QUERY_TIMEOUT)
    if (scratchpads.length === 0) return interaction.editReply(this.#CODE_NOT_FOUND)
    this.rankScratchpads(scratchpads, sort)

    const paginatedMessage = this.paginatedMessageCode(query, scratchpads, sort, stopwatch)
    return paginatedMessage.run(interaction, interaction.user)
  }

  private pipelineUser(query: string, sort: UserSortOptions) {
    const mongodbMapping = {
      votes: 'scratchpadData.votes',
      forks: 'scratchpadData.forks',
      programs: 'scratchpadData.count',
      questions: 'questions',
      answers: 'answers',
      comments: 'comments',
      replies: 'replies',
      projectquestions: 'projectquestions',
      projectanswers: 'projectanswers',
    }
    const sortStage = {
      $sort: {
        [mongodbMapping[sort]]: -1,
      },
    }
    return [
      {
        $match: {
          $text: {
            $search: query,
          },
        },
      },
      {
        $lookup: {
          from: 'scratchpads',
          let: {
            authorID: '$authorID',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$authorID', '$$authorID'],
                },
              },
            },
            {
              $project: {
                votes: 1,
                forks: 1,
              },
            },
          ],
          as: 'scratchpads',
        },
      },
      {
        $addFields: {
          scratchpadStats: {
            $reduce: {
              input: '$scratchpads',
              initialValue: {
                votes: 0,
                forks: 0,
              },
              in: {
                votes: {
                  $add: ['$$value.votes', '$$this.votes'],
                },
                forks: {
                  $add: ['$$value.forks', '$$this.forks'],
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          scratchpadStats: {
            count: {
              $size: '$scratchpads',
            },
            votes: {
              $subtract: [
                '$scratchpadStats.votes',
                {
                  $size: '$scratchpads',
                },
              ],
            },
          },
        },
      },
      {
        $project: {
          scratchpads: 0,
        },
      },
      sortStage,
      {
        $limit: config.search.resultsPerPage * 25,
      },
    ]
  }

  private rankAuthors(authors: AuthorDocument[], sort: UserSortOptions) {
    switch (sort) {
      case 'votes':
        rank(authors, '-scratchpadStats.votes', '-scratchpadStats.forks', '-scratchpadStats.count')
        break
      case 'forks':
        rank(authors, '-scratchpadStats.forks', '-scratchpadStats.votes', '-scratchpadStats.count')
        break
      case 'programs':
        rank(authors, '-scratchpadStats.count', '-scratchpadStats.votes', '-scratchpadStats.forks')
        break
      case 'questions':
        rank(authors, '-questions', '-answers', '-comments', '-replies', '-projectquestions', '-projectanswers')
        break
      case 'answers':
        rank(authors, '-answers', '-questions', '-comments', '-replies', '-projectquestions', '-projectanswers')
        break
      case 'comments':
        rank(authors, '-comments', '-replies', '-questions', '-answers', '-projectquestions', '-projectanswers')
        break
      case 'replies':
        rank(authors, '-replies', '-comments', '-questions', '-answers', '-projectquestions', '-projectanswers')
        break
      case 'projectquestions':
        rank(authors, '-projectquestions', '-projectanswers', '-comments', '-replies', '-questions', '-answers')
        break
      case 'projectanswers':
        rank(authors, '-projectanswers', '-projectquestions', '-comments', '-replies', '-questions', '-answers')
        break
    }
  }

  private paginatedMessageUser(query: string, authors: AuthorDocument[], sort: UserSortOptions, stopwatch: Stopwatch) {
    const paginatedMessage = new PaginatedMessage({
      template: new MessageEmbed() //
        .setColor('GREEN')
        .setFooter({
          text: formatStopwatch(stopwatch),
        }),
    })

    for (let i = 0; i < authors.length; i += config.search.resultsPerPage) {
      paginatedMessage.addPageEmbed((embed) =>
        embed //
          .setTitle(
            `${authors.length === config.search.resultsPerPage * 25 ? authors.length + '+' : authors.length} results for ${inlineCode(query)}`
          )
          .addFields(
            authors //
              .slice(i, i + config.search.resultsPerPage)
              .map((author) => {
                const votesStr = `${author.scratchpadStats.votes.toLocaleString()} Votes`,
                  forksStr = `${author.scratchpadStats.forks.toLocaleString()} Forks`,
                  programsStr = `${author.scratchpadStats.count.toLocaleString()} Programs`,
                  questionsStr = `${author.questions.toLocaleString()} Questions`,
                  answersStr = `${author.answers.toLocaleString()} Answers`,
                  commentsStr = `${author.comments.toLocaleString()} Tips & Thanks`,
                  repliesStr = `${author.replies.toLocaleString()} Replies`,
                  projectquestionsStr = `${author.projectquestions.toLocaleString()} Help Requests`,
                  projectanswersStr = `${author.projectanswers.toLocaleString()} Help Replies`
                let valueArr: string[]
                switch (sort) {
                  case 'votes':
                    valueArr = [votesStr, forksStr, programsStr]
                    break
                  case 'forks':
                    valueArr = [forksStr, votesStr, programsStr]
                    break
                  case 'programs':
                    valueArr = [programsStr, votesStr, forksStr]
                    break
                  case 'questions':
                    valueArr = [questionsStr, answersStr]
                    break
                  case 'answers':
                    valueArr = [answersStr, questionsStr]
                    break
                  case 'comments':
                    valueArr = [commentsStr, repliesStr]
                    break
                  case 'replies':
                    valueArr = [repliesStr, commentsStr]
                    break
                  case 'projectquestions':
                    valueArr = [projectquestionsStr, projectanswersStr]
                    break
                  case 'projectanswers':
                    valueArr = [projectanswersStr, projectquestionsStr]
                    break
                }

                return {
                  name: displayName(author.nickname, author.username, 'kaid_' + author.authorID, EmbedLimits.MaximumFieldNameLength, false),
                  value: hyperlink('🔗', profileURL(author.username, 'kaid_' + author.authorID)) + EN_SPACE_CHAR + valueArr.join(BULLET_SEPARATOR),
                }
              })
          )
      )
    }

    return paginatedMessage
  }

  public async chatInputUser(interaction: Subcommand.ChatInputInteraction) {
    await interaction.deferReply()

    const stopwatch = new Stopwatch()

    const query = interaction.options.getString('query', true),
      sort = (interaction.options.getString('sort') ?? 'votes') as UserSortOptions
    if (profanity.exists(query)) return interaction.editReply(this.#INAPPROPRIATE_QUERY)

    const authors = (await aggregate(Collections.Authors, this.pipelineUser(query, sort))) as AuthorDocument[] | null
    if (authors === null) return interaction.editReply(this.#QUERY_TIMEOUT)
    if (authors.length === 0) return interaction.editReply(this.#USER_NOT_FOUND)
    this.rankAuthors(authors, sort)

    const paginatedMessage = this.paginatedMessageUser(query, authors, sort, stopwatch)
    return paginatedMessage.run(interaction, interaction.user)
  }
}

type CodeSortOptions = 'votes' | 'forks' | 'oldest' | 'newest'
type UserSortOptions = 'votes' | 'forks' | 'programs' | 'questions' | 'answers' | 'comments' | 'replies' | 'projectquestions' | 'projectanswers'
