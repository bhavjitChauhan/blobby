import { deferReply, formatFieldHeading, formatFieldWarning, formatStopwatch } from '../utils/discord'
import { Stopwatch } from '@sapphire/stopwatch'
import { BULLET_SEPARATOR, ErrorMessages } from '../constants'
import { profanity } from '@2toad/profanity'
import { khanClient } from '../khan-cookies'
import { ButtonInteraction, MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { truncate } from '../utils/general'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { avatarURL, displayNameFooter, profileURL } from '../utils/khan'
import { time } from '@discordjs/builders'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import type { User } from '@bhavjit/khan-api'

export async function userGet(interaction: Subcommand.ChatInputInteraction | ButtonInteraction, identifier: string) {
  await deferReply(interaction)

  const stopwatch = new Stopwatch()

  if (profanity.exists(identifier)) {
    await interaction.editReply(ErrorMessages.InappropriateUser)
    return
  }

  const user = await getProfileData(identifier)
  if (user === null) {
    await interaction.editReply(ErrorMessages.UserNotFound)
    return
  }

  const embed = createEmbed(user)
  embed.setFooter({
    text: [embed.footer!.text, formatStopwatch(stopwatch)].join(BULLET_SEPARATOR),
    iconURL: embed.footer!.iconURL,
  })
  await interaction.editReply({
    embeds: [embed],
    components: createComponents(user),
  })
}

async function getProfileData(identifier: string) {
  const user = await khanClient.getUser(identifier).catch((err) => console.error(err))
  if (!user) return null

  await Promise.all([
    user.getAllPrograms().catch((err) => console.error(err)),
    user.getAvatar().catch((err) => console.error(err)),
    user.getStatistics().catch((err) => console.error(err)),
  ])

  return user
}

function createEmbed(user: User) {
  const embed = new MessageEmbed()
    .setColor('GREEN')
    .setTitle(truncate(user.nickname ?? user.username ?? user.kaid ?? 'Unknown user', EmbedLimits.MaximumTitleLength))
    .setURL(profileURL(user.username, user.kaid ?? ''))
    .setThumbnail(avatarURL(user.avatar ?? 'https://www.khanacademy.org/images/avatars/svg/blobby-green.svg'))
    .setDescription(truncate(user.bio ?? 'No bio', EmbedLimits.MaximumDescriptionLength))
    .addFields(
      formatFieldHeading('Programs'),
      {
        name: 'Programs Created',
        value: user.programs?.length.toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Votes Received',
        value: user.programs?.reduce((acc, program) => acc + (program.votes ?? 0), 0).toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Spin-Offs Received',
        value: user.programs?.reduce((acc, program) => acc + (program.spinOffCount ?? 0), 0).toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Votes Given',
        value: user.statistics?.votes.toLocaleString() ?? '❔',
        inline: true,
      },
      formatFieldHeading('Discussion'),
      {
        name: 'Questions',
        value: user.statistics?.questions.toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Answers',
        value: user.statistics?.answers.toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Tips & Thanks',
        value: user.statistics?.tipsAndThanks.toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Replies',
        value: user.statistics?.replies.toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Help Requests',
        value: user.statistics?.helpRequests.toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Help Replies',
        value: user.statistics?.helpRequestAnswers.toLocaleString() ?? '❔',
        inline: true,
      }
    )
    .setFooter({
      text: displayNameFooter(user.username, user.kaid ?? 'Unknown user'),
      iconURL: avatarURL(user.avatar ?? 'https://www.khanacademy.org/images/avatars/svg/blobby-green.svg'),
    })

  if (user.joined && user.badgeCounts) {
    embed.fields.unshift(
      formatFieldHeading('Account'),
      {
        name: 'Points',
        value: user.points?.toLocaleString() ?? '❔',
        inline: true,
      },
      {
        name: 'Joined',
        value: time(new Date(user.joined), 'D'),
        inline: true,
      },
      {
        name: 'Badges',
        value: Object.values(user.badgeCounts)
          .reduce((total, count) => (total as number) + (count as number))
          .toLocaleString(),
        inline: true,
      },
      {
        name: 'Videos Watched',
        value: user.completedVideos?.toLocaleString() ?? '❔',
        inline: true,
      }
    )
  } else embed.fields.unshift(formatFieldWarning('This user has chosen to keep some of their information private.'))

  return embed
}

function createComponents(user: User) {
  return [
    new MessageActionRow().addComponents(
      new MessageButton() //
        .setEmoji('👥')
        .setLabel('Profile')
        .setStyle('LINK')
        .setURL(profileURL(user.username, user.kaid ?? ''))
    ),
  ]
}
