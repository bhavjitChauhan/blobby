import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { aggregate, Collections } from '../../lib/mongodb/mongodb'
import { EmbedLimits, LazyPaginatedMessage, PaginatedMessage } from '@sapphire/discord.js-utilities'
import { Colors, EmbedBuilder, type EmbedField } from 'discord.js'
import config from '../../config'
import { BULLET_SEPARATOR, EN_SPACE_CHAR } from '../../lib/constants'
import { displayName, profileURL, programURL } from '../../lib/utils/khan'
import type { AuthorDocument as MongoDbAuthorDocument } from '../../lib/mongodb/types'
import { rank, truncate } from '../../lib/utils/general'
import { hyperlink, inlineCode, time } from '@discordjs/builders'
import { Stopwatch } from '@sapphire/stopwatch'
import { deferReply, formatFieldWarning, formatStopwatch } from '../../lib/utils/discord'
import { profanity } from '@2toad/profanity'
import { Indices, ProgramTypeScratchpadType } from '../../lib/elasticsearch/client'
import { Program, type Kaid, ProgramType, isKaid, resolveKaid } from '@bhavjit/khan-api'
import type { QueryDslQueryContainer, SearchHitsMetadata } from '@elastic/elasticsearch/lib/api/types'
import { simpleQueryStringQuery, termQuery, termsQuery } from '../../lib/elasticsearch/builders'
import { formatTotalHits, resolveTotalHits } from '../../lib/elasticsearch/utils'
import { searchBoolean, searchUser } from '../../lib/elasticsearch/search'
import type {
  ScratchpadField,
  AuthorDocument as ElasticAuthorDocument,
  ScratchpadDocument as ElasticScratchpadDocument,
} from '../../lib/elasticsearch/types'
import { SapphirePaginatedMessageLimits } from '../../lib/utils/limits'

@ApplyOptions<Subcommand.Options>({
  description: 'Search for a Khan Academy user or program',
  preconditions: ['UserRateLimit'],
  subcommands: [
    {
      name: 'user',
      chatInputRun: 'chatInputUser',
    },
    {
      name: 'program',
      chatInputRun: 'chatInputProgram',
    },
  ],
})
export class UserCommand extends Subcommand {
  readonly #INAPPROPRIATE_QUERY = "I can't search for that"
  readonly #NO_QUERY = 'I need something to search for'
  readonly #QUERY_TIMEOUT = 'The search took too long'
  readonly #USER_NOT_FOUND = "I couldn't find any matching users"
  readonly #PROGRAM_NOT_FOUND = "I couldn't find any matching programs"

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

  readonly ProgramSortField: Record<ProgramSort, ScratchpadField> = {
    votes: 'votes',
    forks: 'forks',
    oldest: 'created',
    newest: 'created',
  }
  readonly ProgramSortMapping: Record<ProgramSort, string> = {
    votes: 'Votes',
    forks: 'Spin-Offs',
    oldest: 'Oldest',
    newest: 'Newest',
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
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
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('program')
              .setDescription('Search for a Khan Academy program')
              .addStringOption((option) =>
                option //
                  .setName('title')
                  .setDescription('What title should the program have?')
              )
              .addStringOption((option) =>
                option //
                  .setName('code')
                  .setDescription('What should I search the code for?')
              )
              .addStringOption((option) =>
                option //
                  .setName('description')
                  .setDescription('What should I search any description for?')
              )
              .addStringOption((option) =>
                option //
                  .setName('type')
                  .setDescription('What type should the program be?')
                  .addChoices(
                    {
                      name: 'Processing.js',
                      value: Program.Type.ProcessingJS,
                    },
                    {
                      name: 'Webpage',
                      value: Program.Type.HTML,
                    },
                    {
                      name: 'SQL',
                      value: Program.Type.SQL,
                    }
                  )
              )
              .addStringOption((option) =>
                option //
                  .setName('user')
                  .setDescription('Who (KAID or username) should the program be made by?')
              )
              .addStringOption((option) =>
                option //
                  .setName('sort')
                  .setDescription('What should I sort the programs by?')
                  .addChoices(
                    {
                      name: this.ProgramSortMapping.votes,
                      value: ProgramSort.Votes,
                    },
                    {
                      name: this.ProgramSortMapping.forks,
                      value: ProgramSort.Forks,
                    },
                    {
                      name: this.ProgramSortMapping.oldest,
                      value: ProgramSort.Oldest,
                    },
                    {
                      name: this.ProgramSortMapping.newest,
                      value: ProgramSort.Newest,
                    }
                  )
              )
          ),
      { idHints: ['1015062111354892429', '1020204330307047474'] }
    )
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
        .setTitle(`${formatTotalHits(hits)} results for ${inlineCode(query)}`)
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

    const total = resolveTotalHits(hits)
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
    const stopwatch = new Stopwatch()
    await deferReply(interaction)

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
      const hits = response.hits,
        total = resolveTotalHits(hits)
      if (!total || total === 0) return interaction.editReply(this.#USER_NOT_FOUND)

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

  private pageEmbedFieldProgram(result: ElasticScratchpadDocument) {
    const valueArr = [`${result.votes.toLocaleString()} votes`, `${result.forks.toLocaleString()} spin-offs`]
    if (result.created) valueArr.unshift(time(new Date(result.created), 'd'))
    return {
      name: truncate(result.title ?? 'Untitled', EmbedLimits.MaximumFieldNameLength),
      value: hyperlink('🔗', programURL(result.scratchpadID)) + EN_SPACE_CHAR + valueArr.join(BULLET_SEPARATOR),
    } as EmbedField
  }

  private lazyPaginatedMessageProgram(
    hits: SearchHitsMetadata<ElasticScratchpadDocument>,
    queries: QueryDslQueryContainer[],
    sort: Record<string, string> | undefined,
    stopwatch: Stopwatch
  ) {
    const paginatedMessage = new LazyPaginatedMessage({
      template: new EmbedBuilder() //
        .setColor(Colors.Green)
        .setTitle(`${formatTotalHits(hits)} results`)
        .setFooter({
          text: formatStopwatch(stopwatch),
        }),
    })

    const createFields = (hits: SearchHitsMetadata<ElasticScratchpadDocument>) => {
      return hits.hits
        .filter(({ _source }) => typeof _source !== undefined)
        .map(({ _source }) => {
          _source = _source as ElasticScratchpadDocument
          return this.pageEmbedFieldProgram(_source)
        })
    }

    paginatedMessage.addPageEmbed((embed) =>
      embed //
        .addFields(createFields(hits))
    )

    const total = resolveTotalHits(hits)
    if (!total || total <= config.itemsPerPage) {
      if (!total) this.container.logger.warn(`Invalid total hits for query ${queries} (${hits.total})`)
      return paginatedMessage
    }

    for (let i = config.itemsPerPage; i < total; i += config.itemsPerPage) {
      paginatedMessage.addAsyncPageEmbed(async (embed) => {
        const stopwatch = new Stopwatch()
        const results = await searchBoolean(Indices.Scratchpads, queries, sort, config.itemsPerPage, i)
        if (!results) return embed
        return embed //
          .addFields(createFields(results.hits))
          .setFooter({ text: formatStopwatch(stopwatch) })
      })
      if (paginatedMessage.pages.length >= SapphirePaginatedMessageLimits.MaximumPages) break
    }

    return paginatedMessage
  }

  public async chatInputProgram(interaction: Subcommand.ChatInputCommandInteraction) {
    const stopwatch = new Stopwatch()
    await deferReply(interaction)

    const title = interaction.options.getString('title'),
      code = interaction.options.getString('code'),
      description = interaction.options.getString('description'),
      type = interaction.options.getString('type') as ProgramType,
      user = interaction.options.getString('user'),
      sortOption = interaction.options.getString('sort') as ProgramSort | undefined
    if (!title && !code && !description) return interaction.editReply(this.#NO_QUERY)
    if (profanity.exists(`${title}\n${code}`)) return interaction.editReply(this.#INAPPROPRIATE_QUERY)
    let kaid
    if (user && !isKaid(user)) kaid = await resolveKaid(user)
    const queries = [
      title ? simpleQueryStringQuery(title, 'title') : null,
      code ? simpleQueryStringQuery(code, 'code') : null,
      description ? simpleQueryStringQuery(description, 'description') : null,
      type ? termsQuery('type', ProgramTypeScratchpadType[type] as string[]) : null,
      kaid ? termQuery('authorID', kaid.slice(5)) : null,
    ].filter((query) => query !== null) as QueryDslQueryContainer[]
    const sort = sortOption ? { [this.ProgramSortField[sortOption]]: sortOption === 'oldest' ? 'asc' : 'desc' } : undefined
    const response = await searchBoolean(Indices.Scratchpads, queries, sort, config.itemsPerPage)
    if (response === null) return interaction.editReply(this.#PROGRAM_NOT_FOUND)
    const hits = response.hits,
      total = resolveTotalHits(hits)
    if (!total || total === 0) return interaction.editReply(this.#PROGRAM_NOT_FOUND)

    const paginatedMessage = this.lazyPaginatedMessageProgram(hits, queries, sort, stopwatch)
    return paginatedMessage.run(interaction, interaction.user)
  }
}

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

const enum ProgramSort {
  Votes = 'votes',
  Forks = 'forks',
  Oldest = 'oldest',
  Newest = 'newest',
}
