import { deferReply, formatFieldHeading, formatFieldWarning, formatStopwatch } from '../utils/discord'
import { Stopwatch } from '@sapphire/stopwatch'
import { avatarURL, displayNameFooter, displayNamePrimary, parseProgram, profileURL, truncateScratchpadHyperlink } from '../utils/khan'
import { AcceptedRunEnvironments, BULLET_SEPARATOR, ErrorMessages, KHANALYTICS_START, RunEnvironments, RunEnvironmentTitles } from '../constants'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { truncate, within } from '../utils/general'
import { bold, inlineCode, time } from '@discordjs/builders'
import { Time } from '@sapphire/time-utilities'
import { khanClient } from '../khan-cookies'
import config from '../../config'
import type { Question, TipsAndThanks } from '@bhavjit/khan-api'

export async function programGet(interaction: Subcommand.ChatInputCommandInteraction, program: string) {
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
    text: [embed.data.footer!.text, formatStopwatch(stopwatch)].join(BULLET_SEPARATOR),
    iconURL: embed.data.footer!.icon_url,
  })
  await interaction
    .editReply({
      embeds: [embed],
      components: createComponents(data as ScratchpadData),
    })
    .catch((err) => console.error(err))
}

async function getScratchpadData(id: number) {
  const program = await khanClient.getProgram(id).catch((err) => {
    console.error(err)
    return null
  })
  if (program)
    await program.author
      ?.get()
      .then((author) => author?.getAvatar())
      .catch((err) => console.log(err))

  let questions: Question[] = []
  const questionsGenerator = khanClient.getProgramQuestions(id)
  while (questions.length < config.program.discussionLimit) {
    const { done, value } = await questionsGenerator.next().catch((err) => {
      console.error(err)
      return { done: true, value: null }
    })
    if (!value) break
    questions = [...questions, ...value]
    if (done) break
  }

  let comments: TipsAndThanks[] = []
  const commentsGenerator = khanClient.getProgramTipsAndThanks(id)
  while (comments.length < config.program.discussionLimit) {
    const { done, value } = await commentsGenerator.next().catch((err) => {
      console.error(err)
      return { done: true, value: null }
    })
    if (!value) break
    comments = [...comments, ...value]
    if (done) break
  }

  if (program === null) return null

  return {
    scratchpad: program,
    questions,
    comments,
  }
}

function createEmbed(scratchpadData: ScratchpadData) {
  const scratchpad = scratchpadData.scratchpad,
    questions = scratchpadData.questions,
    questionsComplete = questions.length >= config.program.discussionLimit,
    comments = scratchpadData.comments,
    commentsComplete = comments.length >= config.program.discussionLimit,
    tags = [],
    created = scratchpad.created ? new Date(scratchpad.created) : null,
    updated = scratchpad.updated ? new Date(scratchpad.updated) : null

  if (scratchpad.hidden) tags.push('🙈 Hidden')
  if (scratchpad.author?.child) tags.push('👶 Child Program')
  if (scratchpad.origin) tags.push('🖨 Spin-Off')

  const embed = new EmbedBuilder()
    .setColor('Green')
    .setAuthor({
      name: displayNamePrimary(
        scratchpadData.scratchpad.author?.nickname,
        scratchpadData.scratchpad.author?.username,
        scratchpadData.scratchpad.author?.kaid ?? 'Unknown',
        EmbedLimits.MaximumAuthorNameLength
      ),
      url: scratchpadData.scratchpad.author?.kaid
        ? profileURL(scratchpadData.scratchpad.author?.username, scratchpadData.scratchpad.author?.kaid)
        : '',
      iconURL: avatarURL(scratchpadData.scratchpad.author?.avatar ?? 'https://www.khanacademy.org/images/avatars/blobby-green.png'),
    })
    .setTitle(scratchpad.title ? truncate(scratchpad.title, EmbedLimits.MaximumTitleLength) : 'Untitled')
    .setURL(scratchpad.url ?? '')
    .setImage(scratchpad.thumbnailUrl ?? '')
    .addFields(
      formatFieldHeading('Program'),
      {
        name: 'Type',
        value: AcceptedRunEnvironments.includes(scratchpad.rawData?.userAuthoredContentType ?? '')
          ? RunEnvironmentTitles[scratchpad.rawData?.userAuthoredContentType as RunEnvironments]
          : inlineCode(scratchpad.rawData?.userAuthoredContentType ?? 'null'),
        inline: true,
      },
      {
        name: 'Votes',
        value: (scratchpad.votes ?? 0).toLocaleString(),
        inline: true,
      },
      {
        name: 'Spin-Offs',
        value: (scratchpad.spinOffCount ?? 0).toLocaleString(),
        inline: true,
      },
      {
        name: 'Created',
        value: created ? (within(created.getTime(), updated?.getTime() ?? 0, Time.Day, Time.Minute) ? time(created) : time(created, 'D')) : 'Unknown',
        inline: true,
      },
      {
        name: 'Updated',
        value:
          created && updated
            ? within(created.getTime(), updated.getTime(), Time.Minute)
              ? 'Never'
              : within(created.getTime(), updated.getTime(), Time.Day)
              ? time(updated)
              : time(updated, 'D')
            : 'Never',
        inline: true,
      },
      ...(questions || comments ? [formatFieldHeading('Discussion')] : []),
      ...(questions
        ? [
            {
              name: 'Questions',
              value: questions.length.toLocaleString() + (!questionsComplete ? '+' : ''),
              inline: true,
            },
            {
              name: 'Question Votes',
              value: questions.reduce((acc, { votes }) => (votes ? acc + votes : 0), 0).toLocaleString() + (!questionsComplete ? '+' : ''),
              inline: true,
            },
            {
              name: 'Question Replies',
              value:
                questions.reduce((acc, { replyCount }) => (replyCount ? acc + replyCount : 0), 0).toLocaleString() + (!questionsComplete ? '+' : ''),
              inline: true,
            },
          ]
        : []),
      ...(comments
        ? [
            {
              name: 'Comments',
              value: comments.length.toLocaleString() + (!commentsComplete ? '+' : ''),
              inline: true,
            },
            {
              name: 'Comment Votes',
              value: comments.reduce((acc, { votes }) => (votes ? acc + votes : 0), 0).toLocaleString() + (!commentsComplete ? '+' : ''),
              inline: true,
            },
            {
              name: 'Comment Replies',
              value:
                comments.reduce((acc, { replyCount }) => (replyCount ? acc + replyCount : 0), 0).toLocaleString() + (!commentsComplete ? '+' : ''),
              inline: true,
            },
          ]
        : [])
    )
    .setFooter({
      text: displayNameFooter(scratchpadData.scratchpad.author?.username, scratchpadData.scratchpad.author?.kaid ?? 'Unknown'),
      iconURL: avatarURL(scratchpadData.scratchpad.author?.avatar ?? 'https://www.khanacademy.org/images/avatars/blobby-green.png'),
    })

  if (tags.length > 0) embed.setDescription(tags.map((tag) => bold(tag)).join(', '))
  if (scratchpad.origin) {
    embed.spliceFields(
      embed.data.fields!.findIndex((field) => field.name === 'Updated'),
      0,
      {
        name: 'Original',
        value: truncateScratchpadHyperlink(
          scratchpadData.scratchpad.origin!.title ?? 'Untitled',
          scratchpadData.scratchpad.origin!.rawData?.url?.split('/')[2] ?? '',
          scratchpadData.scratchpad.origin?.id ?? 0,
          EmbedLimits.MaximumFieldValueLength
        ),
        inline: true,
      }
    )
  }
  if (!questionsComplete || !commentsComplete) {
    const fields = [...embed.data.fields!]
    fields.unshift(
      formatFieldWarning(
        `This program has too many ${
          !questionsComplete && !commentsComplete ? 'questions and comments' : !questionsComplete ? 'questions' : 'comments'
        } to load.`
      )
    )
    embed.setFields(fields)
  }

  return embed
}

function createComponents(scratchpadData: ScratchpadData) {
  const components = [
    new ButtonBuilder() //
      .setCustomId(`run-pjs-${scratchpadData.scratchpad.id}`)
      .setStyle(ButtonStyle.Success)
      .setLabel('Run'),
    new ButtonBuilder() //
      .setCustomId(`user-get-${scratchpadData.scratchpad.author?.kaid}`)
      .setStyle(ButtonStyle.Primary)
      .setLabel('User'),
    new ButtonBuilder() //
      .setCustomId(`program-code-${scratchpadData.scratchpad.id}`)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Code'),
    new ButtonBuilder() //
      .setEmoji('🖥')
      .setLabel('Program')
      .setStyle(ButtonStyle.Link)
      .setURL(
        scratchpadData.scratchpad.url ?? 0 <= 512
          ? scratchpadData.scratchpad.url ?? ''
          : `https://www.khanacademy.org/computer-programming/-/${scratchpadData.scratchpad.id}`
      ),
  ]
  if (scratchpadData.scratchpad.created && new Date(scratchpadData.scratchpad.created).getTime() > KHANALYTICS_START)
    components.push(
      new ButtonBuilder() //
        .setEmoji('📊')
        .setLabel('Khanalytics')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://khanalytics.herokuapp.com/program/${scratchpadData.scratchpad.id}?ref=discord`)
    )
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(components)]
}

type ScratchpadData = NonNullable<Awaited<ReturnType<typeof getScratchpadData>>>
