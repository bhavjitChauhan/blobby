import { bold, inlineCode, time } from '@discordjs/builders'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { Stopwatch } from '@sapphire/stopwatch'
import { Time } from '@sapphire/time-utilities'
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { discussion, programs, utils } from 'ka-api'
import config from '../../config'
import { AcceptedRunEnvironments, BULLET_SEPARATOR, khanalyticsRecordingStart, RunEnvironments, RunEnvironmentTitles } from '../../lib/constants'
import { ValidationError } from '../../lib/errors'
import { cookies } from '../../lib/khan-cookies'
import { deferReply, formatFieldHeading, formatFieldWarning, formatStopwatch } from '../../lib/utils/discord'
import { truncate, within } from '../../lib/utils/general'
import { avatarURL, displayNameFooter, displayNamePrimary, profileURL, truncateScratchpadHyperlink } from '../../lib/utils/khan'

const { isValidProgramID } = utils

@ApplyOptions<Subcommand.Options>({
  description: 'Get info about a Khan Academy program',
  preconditions: ['UserRateLimit'],
  subcommands: [
    {
      name: 'get',
      chatInputRun: 'chatInputGet',
    },
    {
      name: 'code',
      chatInputRun: 'chatInputCode',
    },
    {
      name: 'thumbnail',
      chatInputRun: 'chatInputThumbnail',
    },
  ],
})
export class UserCommand extends Subcommand {
  readonly #INVALID_ID = "That doesn't look like a valid program ID"
  readonly #PROGRAM_NOT_FOUND = "I couldn't find that program"
  readonly #FEEDBACK_NOT_FOUND = "I couldn't find any feedback for that program"

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('get')
              .setDescription('Get general information about a program')
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription('The ID or URL of the program')
                  .setRequired(true)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('code')
              .setDescription('Get the code of a program')
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription('The ID or URL of the program')
                  .setRequired(true)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('thumbnail')
              .setDescription('Get the thumbnail of a program')
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription('The ID or URL of the program')
                  .setRequired(true)
              )
          ),
      { idHints: ['1014333490877173890', '1020204328277000212'] }
    )
  }

  private validateID(interaction: Subcommand.ChatInputInteraction) {
    const id = utils.extractProgramID(interaction.options.getString('program', true))
    try {
      isValidProgramID(id)
    } catch (err) {
      throw new ValidationError(this.#INVALID_ID)
    }

    return id
  }

  private async ensureResponse<T>(interaction: Subcommand.ChatInputInteraction, method: (id: string) => Promise<T>): Promise<T | null> {
    try {
      const id = this.validateID(interaction)
      return await method.call(this, id.toString())
    } catch (err) {
      if (err instanceof ValidationError) {
        await interaction.editReply(err.message)
        return null
      } else throw err
    }
  }

  private async getScratchpadData(id: string) {
    const [scratchpad, questions, comments] = await Promise.all([
      programs.showScratchpad(id),
      discussion.feedbackQuery(cookies, id, 'QUESTION', 1, config.program.discussionLimit),
      discussion.feedbackQuery(cookies, id, 'COMMENT', 1, config.program.discussionLimit),
    ]).catch((reason) => {
      if (reason.response?.status === 404) throw new ValidationError(this.#PROGRAM_NOT_FOUND)
      else throw reason
    })

    if (typeof scratchpad === 'string') throw new ValidationError(this.#PROGRAM_NOT_FOUND)
    if (typeof questions.data.feedback === null || typeof comments.data.feedback === null) throw new ValidationError(this.#FEEDBACK_NOT_FOUND)

    return {
      scratchpad,
      questions,
      comments,
    }
  }

  private async getScratchpadCode(id: string) {
    const data = await programs.getProgramJSON(id, { revision: { code: 1 } }).catch((reason) => {
      if (reason.response?.status === 404) throw new ValidationError(this.#PROGRAM_NOT_FOUND)
      else throw reason
    })

    return data.revision.code
  }

  private async getScratchpadThumbnailURL(id: string) {
    const data = await programs.getProgramJSON(id, { imageUrl: 1 }).catch((reason) => {
      if (reason.response?.status === 404) throw new ValidationError(this.#PROGRAM_NOT_FOUND)
      else throw reason
    })

    return data.imageUrl
  }

  private embedsGet(scratchpadData: ScratchpadData) {
    const scratchpad = scratchpadData.scratchpad.scratchpad,
      questions = scratchpadData.questions.data.feedback!.feedback,
      questionsComplete = scratchpadData.questions.data.feedback?.isComplete,
      comments = scratchpadData.comments.data.feedback!.feedback,
      commentsComplete = scratchpadData.comments.data.feedback?.isComplete,
      tags = [],
      created = new Date(scratchpad.created),
      updated = new Date(scratchpad.date)

    if (scratchpad.isChallenge) tags.push('🎯 Challenge')
    if (scratchpad.isPublished) tags.push('🏆 Contest')
    if (scratchpad.hideFromHotlist) tags.push('🙈 Hidden')
    if (scratchpad.flags.length > 0) tags.push(`🚩 Flagged ${scratchpad.flags.length}`)
    if (scratchpad.byChild) tags.push('👶 Child Program')
    if (scratchpad.originScratchpadId !== null) tags.push(`🖨 Spin-Off (${Math.floor(scratchpad.originSimilarity * 100)}%)`)

    const embed = new MessageEmbed()
      .setColor('GREEN')
      .setAuthor({
        name: displayNamePrimary(
          scratchpadData.scratchpad.creatorProfile.nickname,
          scratchpadData.scratchpad.creatorProfile.username,
          scratchpadData.scratchpad.creatorProfile.kaid,
          EmbedLimits.MaximumAuthorNameLength
        ),
        url: profileURL(scratchpadData.scratchpad.creatorProfile.username, scratchpadData.scratchpad.creatorProfile.kaid),
        iconURL: avatarURL(scratchpadData.scratchpad.creatorProfile.avatarSrc),
      })
      .setTitle(scratchpad.title ? truncate(scratchpad.title, EmbedLimits.MaximumTitleLength) : 'Untitled')
      .setURL(scratchpad.url)
      .setImage(scratchpad.imageUrl)
      .addFields(
        formatFieldHeading('Program'),
        {
          name: 'Type',
          value:
            scratchpad.userAuthoredContentType in AcceptedRunEnvironments
              ? RunEnvironmentTitles[scratchpad.userAuthoredContentType as RunEnvironments]
              : inlineCode(scratchpad.userAuthoredContentType ?? 'null'),
          inline: true,
        },
        {
          name: 'Votes',
          value: scratchpad.sumVotesIncremented.toLocaleString(),
          inline: true,
        },
        {
          name: 'Spin-Offs',
          value: scratchpad.spinoffCount.toLocaleString(),
          inline: true,
        },
        {
          name: 'Created',
          value: within(created.getTime(), updated.getTime(), Time.Day, Time.Minute) ? time(created) : time(created, 'D'),
          inline: true,
        },
        {
          name: 'Updated',
          value: within(created.getTime(), updated.getTime(), Time.Minute)
            ? 'Never'
            : within(created.getTime(), updated.getTime(), Time.Day)
            ? time(updated)
            : time(updated, 'D'),
          inline: true,
        },
        formatFieldHeading('Discussion'),
        {
          name: 'Questions',
          value: questions.length.toLocaleString() + (!questionsComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Question Votes',
          value: questions.reduce((acc, { sumVotesIncremented }) => acc + sumVotesIncremented, 0).toLocaleString() + (!questionsComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Question Replies',
          value: questions.reduce((acc, { replyCount }) => acc + replyCount, 0).toLocaleString() + (!questionsComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Comments',
          value: comments.length.toLocaleString() + (!commentsComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Comment Votes',
          value: comments.reduce((acc, { sumVotesIncremented }) => acc + sumVotesIncremented, 0).toLocaleString() + (!commentsComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Comment Replies',
          value: comments.reduce((acc, { replyCount }) => acc + replyCount, 0).toLocaleString() + (!commentsComplete ? '+' : ''),
          inline: true,
        }
      )
      .setFooter({
        text: displayNameFooter(scratchpadData.scratchpad.creatorProfile.username, scratchpadData.scratchpad.creatorProfile.kaid),
        iconURL: avatarURL(scratchpadData.scratchpad.creatorProfile.avatarSrc),
      })

    if (tags.length > 0) embed.setDescription(tags.map((tag) => bold(tag)).join(', '))
    if (scratchpad.originScratchpadId !== null) {
      embed.fields.splice(
        embed.fields.findIndex((field) => field.name === 'Updated'),
        0,
        {
          name: 'Original',
          value: truncateScratchpadHyperlink(
            scratchpadData.scratchpad.originScratchpad!.translatedTitle ?? 'Untitled',
            scratchpadData.scratchpad.originScratchpad!.slug,
            scratchpadData.scratchpad.originScratchpad!.id,
            EmbedLimits.MaximumFieldValueLength
          ),
          inline: true,
        }
      )
    }
    if (!questionsComplete || !commentsComplete)
      embed.fields.unshift(
        formatFieldWarning(
          `This program has too many ${
            !questionsComplete && !commentsComplete ? 'questions and comments' : !questionsComplete ? 'questions' : 'comments'
          } to load.`
        )
      )

    return [embed]
  }

  private componentsGet(scratchpadData: ScratchpadData) {
    const components = [
      new MessageButton() //
        .setEmoji('🖥')
        .setLabel('Program')
        .setStyle('LINK')
        .setURL(
          scratchpadData.scratchpad.scratchpad.url.length <= 512
            ? scratchpadData.scratchpad.scratchpad.url
            : `https://www.khanacademy.org/computer-programming/-/${scratchpadData.scratchpad.scratchpad.id}`
        ),
      new MessageButton() //
        .setEmoji('👥')
        .setLabel('Profile')
        .setStyle('LINK')
        .setURL(profileURL(scratchpadData.scratchpad.creatorProfile.username, scratchpadData.scratchpad.creatorProfile.kaid)),
    ]
    if (new Date(scratchpadData.scratchpad.scratchpad.created).getTime() > khanalyticsRecordingStart)
      components.push(
        new MessageButton() //
          .setEmoji('📊')
          .setLabel('Khanalytics')
          .setStyle('LINK')
          .setURL(`https://khanalytics.herokuapp.com/program/${scratchpadData.scratchpad.scratchpad.id}?ref=discord`)
      )
    return [new MessageActionRow().addComponents(components)]
  }

  public async chatInputGet(interaction: Subcommand.ChatInputInteraction) {
    await deferReply(interaction)

    const stopwatch = new Stopwatch()

    const data = await this.ensureResponse(interaction, this.getScratchpadData)
    if (data === null) return

    const embeds = this.embedsGet(data)
    embeds[0].setFooter({
      text: [embeds[0].footer!.text, formatStopwatch(stopwatch)].join(BULLET_SEPARATOR),
      iconURL: embeds[0].footer!.iconURL,
    })
    await interaction.editReply({
      embeds: embeds,
      components: this.componentsGet(data),
    })
  }

  public async chatInputCode(interaction: Subcommand.ChatInputInteraction) {
    await deferReply(interaction)

    const code = await this.ensureResponse(interaction, this.getScratchpadCode)
    if (code === null) return

    await interaction.editReply({ files: [{ attachment: Buffer.from(code), name: 'code.js' }] })
  }

  public async chatInputThumbnail(interaction: Subcommand.ChatInputInteraction) {
    await deferReply(interaction)

    const thumbnailURL = await this.ensureResponse(interaction, this.getScratchpadThumbnailURL)
    if (thumbnailURL === null) return

    await interaction.editReply({ files: [{ attachment: thumbnailURL, name: 'thumbnail.png' }] })
  }
}

type ScratchpadData = Awaited<ReturnType<UserCommand['getScratchpadData']>>
