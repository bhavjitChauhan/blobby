import { bold, time } from '@discordjs/builders'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { Command } from '@sapphire/framework'
import { Time } from '@sapphire/time-utilities'
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { programs, utils, discussion } from 'ka-api'
import { FOOTER_SEPARATOR, RUN_ENVIRONMENTS } from '../../lib/constants'
import { ValidationError } from '../../lib/errors'
import { cookies } from '../../lib/khan-cookies'
import { formatFieldHeading, formatFieldWarning, truncate, within } from '../../lib/utils'

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
          .addIntegerOption((option) =>
            option //
              .setName('id')
              .setDescription('The ID of the program')
              .setRequired(true)
          ),
      { idHints: ['1014333490877173890'] }
    )
  }

  private profileURL(scratchpadData: ScratchpadData) {
    return `https://www.khanacademy.org/profile/${
      scratchpadData.scratchpad.creatorProfile.username !== ''
        ? scratchpadData.scratchpad.creatorProfile.username
        : scratchpadData.scratchpad.creatorProfile.kaid
    }`
  }

  private avatarURL(scratchpadData: ScratchpadData) {
    return scratchpadData.scratchpad.creatorProfile.avatarSrc.replace('/svg', '').replace('.svg', '.png')
  }

  private async getScratchpadData(interaction: Command.ChatInputInteraction) {
    const id = interaction.options.getInteger('id', true)
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

    const questions = await discussion.feedbackQuery(cookies, scratchpad.scratchpad.id, 'QUESTION', 1, 1e2)
    if (typeof questions.data.feedback === null) throw new ValidationError(this.#FEEDBACK_NOT_FOUND)

    const comments = await discussion.feedbackQuery(cookies, scratchpad.scratchpad.id, 'COMMENT', 1, 1e2)
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
      comments = scratchpadData.comments.data.feedback!.feedback,
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
        name:
          scratchpadData.scratchpad.creatorProfile.nickname ??
          (scratchpadData.scratchpad.creatorProfile.username !== '' && '@' + scratchpadData.scratchpad.creatorProfile.username) ??
          scratchpadData.scratchpad.creatorProfile.kaid,
        url: this.profileURL(scratchpadData),
        iconURL: this.avatarURL(scratchpadData),
      })
      .setTitle(scratchpad.title ? truncate(scratchpad.title, EmbedLimits.MaximumTitleLength) : 'null')
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
          value:
            !within(created.getTime(), updated.getTime(), Time.Minute) && within(created.getTime(), updated.getTime(), Time.Day)
              ? time(created)
              : time(created, 'D'),
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
          value: questions.length.toLocaleString() + (!scratchpadData.questions.data.feedback?.isComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Question Votes',
          value:
            questions.reduce((acc, { sumVotesIncremented }) => acc + sumVotesIncremented, 0).toLocaleString() +
            (!scratchpadData.questions.data.feedback?.isComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Question Replies',
          value:
            questions.reduce((acc, { replyCount }) => acc + replyCount, 0).toLocaleString() +
            (!scratchpadData.questions.data.feedback?.isComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Comments',
          value: comments.length.toLocaleString() + (!scratchpadData.comments.data.feedback?.isComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Comment Votes',
          value:
            comments.reduce((acc, { sumVotesIncremented }) => acc + sumVotesIncremented, 0).toLocaleString() +
            (!scratchpadData.comments.data.feedback?.isComplete ? '+' : ''),
          inline: true,
        },
        {
          name: 'Comment Replies',
          value:
            comments.reduce((acc, { replyCount }) => acc + replyCount, 0).toLocaleString() +
            (!scratchpadData.comments.data.feedback?.isComplete ? '+' : ''),
          inline: true,
        }
      )
      .setFooter({
        text:
          (typeof scratchpadData.scratchpad.creatorProfile.username === 'string' && scratchpadData.scratchpad.creatorProfile.username !== ''
            ? '@' + scratchpadData.scratchpad.creatorProfile.username + FOOTER_SEPARATOR
            : '') + scratchpadData.scratchpad.creatorProfile.kaid,
        iconURL: this.avatarURL(scratchpadData),
      })

    if (tags.length > 0) embed.setDescription(tags.map((tag) => bold(tag)).join(', '))
    if (scratchpad.originScratchpadId !== null) {
      embed.fields.splice(
        embed.fields.findIndex((field) => field.name === 'Updated'),
        0,
        {
          name: 'Original',
          value: `[${truncate(
            scratchpadData.scratchpad.originScratchpad!.translatedTitle ?? 'null',
            EmbedLimits.MaximumFieldValueLength -
              `https://www.khanacademy.org/computer-programming/-/${scratchpadData.scratchpad.originScratchpad!.id}`.length -
              4
          )}](${`https://www.khanacademy.org/computer-programming/-/${scratchpadData.scratchpad.originScratchpad!.id}`})`,
          inline: true,
        }
      )
    }
    if (!scratchpadData.questions.data.feedback?.isComplete || !scratchpadData.comments.data.feedback?.isComplete)
      embed.fields.unshift(
        formatFieldWarning(
          `This program has too many ${
            !scratchpadData.questions.data.feedback?.isComplete && !scratchpadData.comments.data.feedback?.isComplete
              ? 'questions and comments'
              : !scratchpadData.questions.data.feedback?.isComplete
              ? 'questions'
              : 'comments'
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
          .setURL(this.profileURL(scratchpadData)),
        new MessageButton() //
          .setEmoji('📊')
          .setLabel('Khanalytics')
          .setStyle('LINK')
          .setURL(`https://khanalytics.herokuapp.com/program/${scratchpadData.scratchpad.scratchpad.id}?ref=discord`)
      ),
    ]
  }

  public async chatInputRun(interaction: Command.ChatInputInteraction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply()

    let scratchpadData
    try {
      scratchpadData = await this.getScratchpadData(interaction)
    } catch (err) {
      if (err instanceof ValidationError) return interaction.editReply(err.message)
      else throw err
    }

    return interaction.editReply({
      embeds: this.embeds(scratchpadData),
      components: this.components(scratchpadData),
    })
  }
}

type ScratchpadData = Awaited<ReturnType<UserCommand['getScratchpadData']>>
