import { bold, time } from '@discordjs/builders'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { Command } from '@sapphire/framework'
import { Stopwatch } from '@sapphire/stopwatch'
import { Time } from '@sapphire/time-utilities'
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { programs, utils, discussion } from 'ka-api'
import config from '../../config'
import { BULLET_SEPARATOR, RUN_ENVIRONMENTS } from '../../lib/constants'
import { ValidationError } from '../../lib/errors'
import { cookies } from '../../lib/khan-cookies'
import { formatFieldHeading, formatFieldWarning, formatStopwatch } from '../../lib/utils/discord'
import { truncate, within } from '../../lib/utils/general'
import { avatarURL, displayNameFooter, displayNamePrimary, profileURL, truncateScratchpadHyperlink } from '../../lib/utils/khan'

const { isValidProgramID } = utils

@ApplyOptions<Command.Options>({
  description: "Get a Khan Academy program's info",
})
export class UserCommand extends Command {
  readonly #INVALID_ID = "That doesn't look like a valid program ID"
  readonly #PROGRAM_NOT_FOUND = "I couldn't find that program"
  readonly #FEEDBACK_NOT_FOUND = "I couldn't find any feedback for that program"

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option //
              .setName('id')
              .setDescription('The ID or URL of the program')
              .setRequired(true)
          ),
      { idHints: ['1014333490877173890'] }
    )
  }

  private async getScratchpadData(interaction: Command.ChatInputInteraction) {
    const id = utils.extractProgramID(interaction.options.getString('id', true))
    try {
      isValidProgramID(id)
    } catch (err) {
      throw new ValidationError(this.#INVALID_ID)
    }

    const scratchpad = await programs.showScratchpad(id).catch((reason) => {
      if (reason.response?.status === 404) throw new ValidationError(this.#PROGRAM_NOT_FOUND)
      else throw reason
    })
    if (typeof scratchpad === 'string') throw new ValidationError(this.#PROGRAM_NOT_FOUND)

    const questions = await discussion.feedbackQuery(cookies, scratchpad.scratchpad.id, 'QUESTION', 1, config.program.discussionLimit)
    if (typeof questions.data.feedback === null) throw new ValidationError(this.#FEEDBACK_NOT_FOUND)

    const comments = await discussion.feedbackQuery(cookies, scratchpad.scratchpad.id, 'COMMENT', 1, config.program.discussionLimit)
    if (typeof comments.data.feedback === null) throw new ValidationError(this.#FEEDBACK_NOT_FOUND)

    return {
      scratchpad,
      questions,
      comments,
    }
  }

  private embeds(scratchpadData: ScratchpadData) {
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
          value: RUN_ENVIRONMENTS[scratchpad.userAuthoredContentType.replace('webpage', 'html')],
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

  private components(scratchpadData: ScratchpadData) {
    return [
      new MessageActionRow().addComponents(
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
        new MessageButton() //
          .setEmoji('1015128470935834634')
          .setLabel('Khanalytics')
          .setStyle('LINK')
          .setURL(`https://khanalytics.herokuapp.com/program/${scratchpadData.scratchpad.scratchpad.id}?ref=discord`)
      ),
    ]
  }

  public async chatInputRun(interaction: Command.ChatInputInteraction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply()

    const stopwatch = new Stopwatch()

    let scratchpadData
    try {
      scratchpadData = await this.getScratchpadData(interaction)
    } catch (err) {
      if (err instanceof ValidationError) return interaction.editReply(err.message)
      else throw err
    }

    const embeds = this.embeds(scratchpadData)
    embeds[0].setFooter({
      text: [embeds[0].footer!.text, formatStopwatch(stopwatch)].join(BULLET_SEPARATOR),
      iconURL: embeds[0].footer!.iconURL,
    })
    return interaction.editReply({
      embeds: embeds,
      components: this.components(scratchpadData),
    })
  }
}

type ScratchpadData = Awaited<ReturnType<UserCommand['getScratchpadData']>>
