import { deferReply, formatFieldHeading, formatFieldWarning, formatStopwatch } from '../utils/discord'
import { Stopwatch } from '@sapphire/stopwatch'
import { avatarURL, displayNameFooter, displayNamePrimary, parseProgram, profileURL, truncateScratchpadHyperlink } from '../utils/khan'
import { AcceptedRunEnvironments, BULLET_SEPARATOR, ErrorMessages, KHANALYTICS_START, RunEnvironments, RunEnvironmentTitles } from '../constants'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { truncate, within } from '../utils/general'
import { bold, inlineCode, time } from '@discordjs/builders'
import { Time } from '@sapphire/time-utilities'
import { discussion, programs } from 'ka-api'
import { cookies } from '../khan-cookies'
import config from '../../config'

export async function programGet(interaction: Subcommand.ChatInputInteraction, program: string) {
  await deferReply(interaction)

  const stopwatch = new Stopwatch()

  const id = parseProgram(program)
  if (id === null) {
    await interaction.editReply(ErrorMessages.InvalidProgram)
    return
  }

  const data = await getScratchpadData(id)
  if (data === null || data.scratchpad === null) {
    await interaction.editReply(ErrorMessages.ProgramNotFound)
    return
  }
  if (data.questions === null || data.comments === null) {
    await interaction.editReply(ErrorMessages.FeedbackNotFound)
    return
  }

  const embed = createEmbed(data as ScratchpadData)
  embed.setFooter({
    text: [embed.footer!.text, formatStopwatch(stopwatch)].join(BULLET_SEPARATOR),
    iconURL: embed.footer!.iconURL,
  })
  await interaction.editReply({
    embeds: [embed],
    components: createComponents(data as ScratchpadData),
  })
}

async function getScratchpadData(id: number) {
  const scratchpadData = await Promise.all([
    programs.showScratchpad(id),
    discussion.feedbackQuery(cookies, id, 'QUESTION', 1, config.program.discussionLimit),
    discussion.feedbackQuery(cookies, id, 'COMMENT', 1, config.program.discussionLimit),
  ]).catch((reason) => {
    if (reason.response?.status === 404) return null
    else throw reason
  })

  if (scratchpadData === null) return null

  const [scratchpad, questions, comments] = scratchpadData

  if (typeof scratchpad === 'string' || typeof questions.data.feedback === null || typeof comments.data.feedback === null) return null

  return {
    scratchpad,
    questions,
    comments,
  }
}

function createEmbed(scratchpadData: ScratchpadData) {
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
        value: AcceptedRunEnvironments.includes(scratchpad.userAuthoredContentType)
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

  return embed
}

function createComponents(scratchpadData: ScratchpadData) {
  const components = [
    new MessageButton() //
      .setCustomId(`run-pjs-${scratchpadData.scratchpad.scratchpad.id}`)
      .setStyle('SUCCESS')
      .setLabel('Run'),
    new MessageButton() //
      .setCustomId(`user-get-${scratchpadData.scratchpad.creatorProfile.kaid}`)
      .setStyle('PRIMARY')
      .setLabel('User'),
    new MessageButton() //
      .setCustomId(`program-code-${scratchpadData.scratchpad.scratchpad.id}`)
      .setStyle('PRIMARY')
      .setLabel('Code'),
    new MessageButton() //
      .setEmoji('🖥')
      .setLabel('Program')
      .setStyle('LINK')
      .setURL(
        scratchpadData.scratchpad.scratchpad.url.length <= 512
          ? scratchpadData.scratchpad.scratchpad.url
          : `https://www.khanacademy.org/computer-programming/-/${scratchpadData.scratchpad.scratchpad.id}`
      ),
  ]
  if (new Date(scratchpadData.scratchpad.scratchpad.created).getTime() > KHANALYTICS_START)
    components.push(
      new MessageButton() //
        .setEmoji('📊')
        .setLabel('Khanalytics')
        .setStyle('LINK')
        .setURL(`https://khanalytics.herokuapp.com/program/${scratchpadData.scratchpad.scratchpad.id}?ref=discord`)
    )
  return [new MessageActionRow().addComponents(components)]
}

type ScratchpadData = NonNullable<Awaited<ReturnType<typeof getScratchpadData>>>
