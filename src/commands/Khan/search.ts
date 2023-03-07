import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { aggregate, Collections } from '../../lib/mongodb/mongodb'
import { EmbedLimits, LazyPaginatedMessage, PaginatedMessage } from '@sapphire/discord.js-utilities'
import { EmbedBuilder, EmbedField } from 'discord.js'
import config from '../../config'
import { BULLET_SEPARATOR, EN_SPACE_CHAR } from '../../lib/constants'
import { displayName, profileURL, sortScratchpadsByDate } from '../../lib/utils/khan'
import type { AuthorDocument as MongoDbAuthorDocument, ScratchpadDocument } from '../../lib/mongodb/types'
import { rank, truncate } from '../../lib/utils/general'
import { hyperlink, inlineCode, time } from '@discordjs/builders'
import { Stopwatch } from '@sapphire/stopwatch'
import { formatFieldWarning, formatStopwatch } from '../../lib/utils/discord'
import { profanity } from '@2toad/profanity'
import { searchUser } from '../../lib/elasticsearch/elasticsearch'
import type { Kaid } from '@bhavjit/khan-api'
import type { AuthorDocument as ElasticAuthorDocument } from '../../lib/elasticsearch/types'
import type { SearchHitsMetadata } from '@elastic/elasticsearch/lib/api/types'

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

  readonly UserSearchTypeMapping: Record<UserSearchType, string> = {
    [UserSearchType.Elasticsearch]: 'Enhanced',
    [UserSearchType.MongoDB]: 'Simple',
  }
  readonly UserSortMapping: Record<UserSort, string> = {
    votes: 'Votes',
    forks: 'Spin-Offs',
    scratchpads: 'Programs',
    questions: 'Questions',
    answers: 'Answers',
    comments: 'Tips & Thanks',
    replies: 'Replies',
    projectquestions: 'Help Requests',
    projectanswers: 'Help Replies',
    relevance: 'Relevance',
  }

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
                  .setDescription('What should I search the code for?')
                  .setRequired(true)
              )
              .addStringOption((option) =>
                option //
                  .setName('sort')
                  .setDescription('What should I sort the programs by?')
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
                  .setDescription('What nickname or username should I search for?')
                  .setRequired(true)
              )
              .addStringOption((option) =>
                option //
                  .setName('sort')
                  .setDescription('What should I sort the users by?')
                  .addChoices(
                    {
                      name: this.UserSortMapping.votes,
                      value: UserSort.Votes,
                    },
                    {
                      name: this.UserSortMapping.forks,
                      value: UserSort.Forks,
                    },
                    {
                      name: this.UserSortMapping.scratchpads,
                      value: UserSort.Scratchpads,
                    },
                    {
                      name: this.UserSortMapping.questions,
                      value: UserSort.Questions,
                    },
                    {
                      name: this.UserSortMapping.answers,
                      value: UserSort.Answers,
                    },
                    {
                      name: this.UserSortMapping.comments,
                      value: UserSort.Comments,
                    },
                    {
                      name: this.UserSortMapping.replies,
                      value: UserSort.Replies,
                    },
                    {
                      name: this.UserSortMapping.projectquestions,
                      value: UserSort.ProjectQuestions,
                    },
                    {
                      name: this.UserSortMapping.projectanswers,
                      value: UserSort.ProjectAnswers,
                    },
                    {
                      name: `${this.UserSortMapping.relevance} (default)`,
                      value: UserSort.Relevance,
                    }
                  )
              )
              .addStringOption((option) =>
                option //
                  .setName('type')
                  .setDescription('What type of search should I do?')
                  .addChoices(
                    {
                      name: this.UserSearchTypeMapping.mongodb,
                      value: UserSearchType.MongoDB,
                    },
                    {
                      name: `${this.UserSearchTypeMapping.elasticsearch} (default)`,
                      value: UserSearchType.Elasticsearch,
                    }
                  )
              )
          ),
      { idHints: ['1015062111354892429', '1020204330307047474'] }
    )
  }

  private pipelineCode(query: string, sort: CodeSortOptions) {
    return [
      {
        $match: {
          $text: {
            $search: query,
          },
        },
      },
      {
        $sort: {
          [sort === 'oldest' || sort === 'newest' ? 'created' : sort]: sort === 'oldest' ? 1 : -1,
        },
      },
      {
        $limit: config.itemsPerPage * 25,
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
      template: new EmbedBuilder() //
        .setColor('Green')
        .setFooter({
          text: formatStopwatch(stopwatch),
        }),
    })

    for (let i = 0; i < scratchpads.length; i += config.itemsPerPage) {
      paginatedMessage.addPageEmbed((embed) =>
        embed //
          .setTitle(
            `${scratchpads.length === config.itemsPerPage * 25 ? scratchpads.length + '+' : scratchpads.length} results for ${inlineCode(query)}`
          )
          .addFields(
            scratchpads //
              .slice(i, i + config.itemsPerPage)
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

  public async chatInputCode(interaction: Subcommand.ChatInputCommandInteraction) {
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

  private pipelineUser(query: string, sort: UserSort) {
    const mongodbMapping = {
      votes: 'scratchpadData.votes',
      forks: 'scratchpadData.forks',
      scratchpads: 'scratchpadData.count',
      questions: 'questions',
      answers: 'answers',
      comments: 'comments',
      replies: 'replies',
      projectquestions: 'projectquestions',
      projectanswers: 'projectanswers',
    }
    const sortStage =
      sort !== 'relevance'
        ? {
            $sort: {
              [mongodbMapping[sort]]: -1,
            },
          }
        : {}
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
      ...(sort !== 'relevance' ? [sortStage] : []),
      {
        $limit: config.itemsPerPage * 25,
      },
    ]
  }

  private rankAuthorsDocuments(documents: MongoDbAuthorDocument[], sort: UserSort) {
    switch (sort) {
      case 'votes':
        rank(documents, '-scratchpadStats.votes', '-scratchpadStats.forks', '-scratchpadStats.count')
        break
      case 'forks':
        rank(documents, '-scratchpadStats.forks', '-scratchpadStats.votes', '-scratchpadStats.count')
        break
      case 'scratchpads':
        rank(documents, '-scratchpadStats.count', '-scratchpadStats.votes', '-scratchpadStats.forks')
        break
      case 'questions':
        rank(documents, '-questions', '-answers', '-comments', '-replies', '-projectquestions', '-projectanswers')
        break
      case 'answers':
        rank(documents, '-answers', '-questions', '-comments', '-replies', '-projectquestions', '-projectanswers')
        break
      case 'comments':
        rank(documents, '-comments', '-replies', '-questions', '-answers', '-projectquestions', '-projectanswers')
        break
      case 'replies':
        rank(documents, '-replies', '-comments', '-questions', '-answers', '-projectquestions', '-projectanswers')
        break
      case 'projectquestions':
        rank(documents, '-projectquestions', '-projectanswers', '-comments', '-replies', '-questions', '-answers')
        break
      case 'projectanswers':
        rank(documents, '-projectanswers', '-projectquestions', '-comments', '-replies', '-questions', '-answers')
        break
    }
  }

  private pageEmbedFieldUser(result: AuthorResult, type: UserSearchType, sort: UserSort) {
    const votesStr = `${result.votes?.toLocaleString() ?? '❓'} Votes`,
      forksStr = `${result.forks?.toLocaleString() ?? '❓'} Forks`,
      programsStr = `${result.scratchpads?.toLocaleString() ?? '❓'} Programs`,
      questionsStr = `${result.questions.toLocaleString()} Questions`,
      answersStr = `${result.answers.toLocaleString()} Answers`,
      commentsStr = `${result.comments.toLocaleString()} Tips & Thanks`,
      repliesStr = `${result.replies.toLocaleString()} Replies`,
      projectquestionsStr = `${result.projectquestions.toLocaleString()} Help Requests`,
      projectanswersStr = `${result.projectanswers.toLocaleString()} Help Replies`

    let valueArr: string[]
    switch (sort) {
      case UserSort.Relevance:
        valueArr = type === UserSearchType.Elasticsearch ? [commentsStr, questionsStr, repliesStr] : [votesStr, forksStr, programsStr]
        break
      case UserSort.Votes:
        valueArr = [votesStr, forksStr, programsStr]
        break
      case UserSort.Forks:
        valueArr = [forksStr, votesStr, programsStr]
        break
      case UserSort.Scratchpads:
        valueArr = [programsStr, votesStr, forksStr]
        break
      case UserSort.Questions:
        valueArr = [questionsStr, answersStr]
        break
      case UserSort.Answers:
        valueArr = [answersStr, questionsStr]
        break
      case UserSort.Comments:
        valueArr = [commentsStr, repliesStr]
        break
      case UserSort.Replies:
        valueArr = [repliesStr, commentsStr]
        break
      case UserSort.ProjectQuestions:
        valueArr = [projectquestionsStr, projectanswersStr]
        break
      case UserSort.ProjectAnswers:
        valueArr = [projectanswersStr, projectquestionsStr]
        break
    }

    return {
      name: displayName(result.nickname, result.username, result.kaid, EmbedLimits.MaximumFieldNameLength, false),
      value: hyperlink('🔗', profileURL(result.username, result.kaid)) + EN_SPACE_CHAR + valueArr.join(BULLET_SEPARATOR),
    } as EmbedField
  }

  private paginatedMessageUser(
    results: AuthorResult[],
    query: string,
    type: UserSearchType,
    sort: UserSort,
    unsupportedSort: boolean,
    stopwatch: Stopwatch
  ) {
    const paginatedMessage = new PaginatedMessage({
      template: new EmbedBuilder() //
        .setColor('Green')
        .setTitle(`${results.length === config.itemsPerPage * 25 ? results.length + '+' : results.length} results for ${inlineCode(query)}`)
        .addFields(
          unsupportedSort
            ? [
                formatFieldWarning(
                  `${
                    type === UserSearchType.Elasticsearch ? this.UserSearchTypeMapping.mongodb : this.UserSearchTypeMapping.elasticsearch
                  } searches don't support sorting by ${sort}, so I did a ${
                    type === UserSearchType.Elasticsearch ? this.UserSearchTypeMapping.elasticsearch : this.UserSearchTypeMapping.mongodb
                  } search instead`
                ),
              ]
            : []
        )
        .setFooter({
          text: formatStopwatch(stopwatch),
        }),
    })

    for (let i = 0; i < results.length; i += config.itemsPerPage) {
      paginatedMessage.addPageEmbed((embed) =>
        embed //
          .addFields(
            results //
              .slice(i, i + config.itemsPerPage)
              .map((result) => this.pageEmbedFieldUser(result, type, sort))
          )
      )
    }

    return paginatedMessage
  }

  private lazyPaginatedMessageUser(
    hits: SearchHitsMetadata<ElasticAuthorDocument>,
    query: string,
    type: UserSearchType,
    sort: UserSort,
    unsupportedSort: boolean,
    stopwatch: Stopwatch
  ) {
    const paginatedMessage = new LazyPaginatedMessage({
      template: new EmbedBuilder() //
        .setColor('Green')
        .setTitle(`${typeof hits.total === 'number' ? hits.total : hits.total?.value} results for ${inlineCode(query)}`)
        .addFields(
          unsupportedSort
            ? [
                formatFieldWarning(
                  `${
                    type === UserSearchType.Elasticsearch ? this.UserSearchTypeMapping.mongodb : this.UserSearchTypeMapping.elasticsearch
                  } searches don't support sorting by ${sort}, so I did a ${
                    type === UserSearchType.Elasticsearch ? this.UserSearchTypeMapping.elasticsearch : this.UserSearchTypeMapping.mongodb
                  } search instead`
                ),
              ]
            : []
        )
        .setFooter({
          text: formatStopwatch(stopwatch),
        }),
    })

    const createFields = (hits: SearchHitsMetadata<ElasticAuthorDocument>) => {
      return hits.hits
        .filter(({ _source }) => typeof _source !== 'undefined')
        .map(({ _source }) => {
          _source = _source as ElasticAuthorDocument
          return this.pageEmbedFieldUser(
            {
              kaid: `kaid_${_source.authorID}` as Kaid,
              username: _source.username,
              nickname: _source.nickname,
              questions: _source.questions,
              answers: _source.answers,
              comments: _source.comments,
              replies: _source.replies,
              projectquestions: _source.projectquestions,
              projectanswers: _source.projectanswers,
            },
            type,
            sort
          )
        })
    }

    paginatedMessage.addPageEmbed((embed) =>
      embed //
        .addFields(createFields(hits))
    )

    const total = typeof hits.total === 'number' ? hits.total : hits.total?.value
    if (!total || total <= config.itemsPerPage) {
      if (!total) this.container.logger.warn(`Invalid total hits for query ${query} (${hits.total})`)
      return paginatedMessage
    }

    for (let i = config.itemsPerPage; i < total; i += config.itemsPerPage) {
      paginatedMessage.addAsyncPageEmbed(async (embed) => {
        const stopwatch = new Stopwatch()
        const results = await searchUser(query, sort !== 'relevance' ? { [sort]: 'desc' } : undefined, config.itemsPerPage, i)
        if (!results) return embed
        return embed //
          .addFields(createFields(results.hits))
          .setFooter({ text: formatStopwatch(stopwatch) })
      })
    }

    return paginatedMessage
  }

  public async chatInputUser(interaction: Subcommand.ChatInputCommandInteraction) {
    await interaction.deferReply()

    const stopwatch = new Stopwatch()

    const query = interaction.options.getString('query', true),
      sort = (interaction.options.getString('sort') ?? 'relevance') as UserSort
    if (profanity.exists(query)) return interaction.editReply(this.#INAPPROPRIATE_QUERY)

    let type = (interaction.options.getString('type') ?? UserSearchType.Elasticsearch) as UserSearchType,
      unsupportedSort = false
    if (type === UserSearchType.Elasticsearch && (sort === 'votes' || sort === 'forks' || sort === 'scratchpads')) {
      type = UserSearchType.MongoDB
      unsupportedSort = true
    }

    if (type === UserSearchType.Elasticsearch) {
      const response = await searchUser(query, sort !== 'relevance' ? { [sort]: 'desc' } : undefined, config.itemsPerPage)
      if (response === null) return interaction.editReply(this.#USER_NOT_FOUND)
      const hits = response.hits
      if (hits.total === 0) return interaction.editReply(this.#USER_NOT_FOUND)

      const paginatedMessage = this.lazyPaginatedMessageUser(hits, query, type, sort, unsupportedSort, stopwatch)
      return paginatedMessage.run(interaction, interaction.user)
    } else {
      const documents = (await aggregate(Collections.Authors, this.pipelineUser(query, sort))) as MongoDbAuthorDocument[] | null
      if (documents === null) return interaction.editReply(this.#QUERY_TIMEOUT)
      if (documents.length === 0) return interaction.editReply(this.#USER_NOT_FOUND)
      this.rankAuthorsDocuments(documents, sort)

      const results = documents.map((document) => ({
        kaid: `kaid_${document.authorID}` as Kaid,
        username: document.username,
        nickname: document.nickname,
        votes: document.scratchpadStats.votes,
        forks: document.scratchpadStats.forks,
        scratchpads: document.scratchpadStats.count,
        questions: document.questions,
        answers: document.answers,
        comments: document.comments,
        replies: document.replies,
        projectquestions: document.projectquestions,
        projectanswers: document.projectanswers,
      }))

      const paginatedMessage = this.paginatedMessageUser(results, query, type, sort, unsupportedSort, stopwatch)
      return paginatedMessage.run(interaction, interaction.user)
    }
  }
}

type CodeSortOptions = 'votes' | 'forks' | 'oldest' | 'newest'

const enum UserSearchType {
  Elasticsearch = 'elasticsearch',
  MongoDB = 'mongodb',
}
const enum UserSort {
  Votes = 'votes',
  Forks = 'forks',
  Scratchpads = 'scratchpads',
  Questions = 'questions',
  Answers = 'answers',
  Comments = 'comments',
  Replies = 'replies',
  ProjectQuestions = 'projectquestions',
  ProjectAnswers = 'projectanswers',
  Relevance = 'relevance',
}

interface AuthorResult {
  kaid: Kaid
  username?: string
  nickname: string
  votes?: number
  forks?: number
  scratchpads?: number
  questions: number
  answers: number
  comments: number
  replies: number
  projectquestions: number
  projectanswers: number
}
