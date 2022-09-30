import { deferReply, formatFieldHeading, formatFieldWarning, formatStopwatch } from '../utils/discord'
import { Stopwatch } from '@sapphire/stopwatch'
import { BULLET_SEPARATOR, ErrorMessages } from '../constants'
import { profanity } from '@2toad/profanity'
import { profile } from 'ka-api'
import { cookies } from '../khan-cookies'
import { ButtonInteraction, MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { truncate } from '../utils/general'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { avatarURL, displayNameFooter, profileURL } from '../utils/khan'
import { time } from '@discordjs/builders'
import type { Subcommand } from '@sapphire/plugin-subcommands'

export async function userGet(interaction: Subcommand.ChatInputInteraction | ButtonInteraction, user: string) {
  await deferReply(interaction)

  const stopwatch = new Stopwatch()

  if (profanity.exists(user)) {
    await interaction.editReply(ErrorMessages.InappropriateUser)
    return
  }

  const profileData = await getProfileData(user)
  if (profileData === null) {
    await interaction.editReply(ErrorMessages.UserNotFound)
    return
  }

  const embed = createEmbed(profileData)
  embed.setFooter({
    text: [embed.footer!.text, formatStopwatch(stopwatch)].join(BULLET_SEPARATOR),
    iconURL: embed.footer!.iconURL,
  })
  await interaction.editReply({
    embeds: [embed],
    components: createComponents(profileData),
  })
}

async function getProfileData(user: string) {
  const profileInfo = await profile.getProfileInfo(cookies, user)
  if (profileInfo.data.user === null) return null

  const [profileWidgets, avatarData, userPrograms] = await Promise.all([
    profile.getProfileWidgets(cookies, profileInfo.data.user.kaid),
    profile.avatarDataForProfile(cookies, profileInfo.data.user.kaid),
    profile.getUserPrograms(profileInfo.data.user.kaid),
  ])

  if (!profileWidgets.data || profileWidgets.data.userSummary === null || avatarData.data.user === null) return null

  return { info: profileInfo, widgets: profileWidgets, avatar: avatarData, programs: userPrograms }
}

function createEmbed(profileData: ProfileData) {
  const user = profileData.info.data.user!,
    statistics = profileData.widgets.data!.userSummary!.statistics

  const embed = new MessageEmbed()
    .setColor('GREEN')
    .setTitle(truncate(user.nickname, EmbedLimits.MaximumTitleLength))
    .setURL(profileURL(user.username, user.kaid))
    .setThumbnail(avatarURL(profileData.avatar.data.user!.avatar.imageSrc))
    .setDescription(truncate(user.bio, EmbedLimits.MaximumDescriptionLength))
    .addFields(
      formatFieldHeading('Programs'),
      {
        name: 'Programs Created',
        value: profileData.programs.scratchpads.length.toLocaleString(),
        inline: true,
      },
      {
        name: 'Votes Received',
        value: profileData.programs.scratchpads.reduce((a, b) => a + b.sumVotesIncremented - 1, 0).toLocaleString(),
        inline: true,
      },
      {
        name: 'Spin-Offs Received',
        value: profileData.programs.scratchpads.reduce((a, b) => a + Math.abs(b.spinoffCount), 0).toLocaleString(),
        inline: true,
      },
      {
        name: 'Votes Given',
        value: statistics.votes.toLocaleString(),
        inline: true,
      },
      formatFieldHeading('Discussion'),
      {
        name: 'Questions',
        value: statistics.questions.toLocaleString(),
        inline: true,
      },
      {
        name: 'Answers',
        value: statistics.answers.toLocaleString(),
        inline: true,
      },
      {
        name: 'Tips & Thanks',
        value: statistics.comments.toLocaleString(),
        inline: true,
      },
      {
        name: 'Replies',
        value: statistics.replies.toLocaleString(),
        inline: true,
      },
      {
        name: 'Help Requests',
        value: statistics.projectquestions.toLocaleString(),
        inline: true,
      },
      {
        name: 'Help Replies',
        value: statistics.projectanswers.toLocaleString(),
        inline: true,
      }
    )
    .setFooter({
      text: displayNameFooter(user.username, user.kaid),
      iconURL: avatarURL(profileData.avatar.data.user!.avatar.imageSrc),
    })

  if (user.joined && user.badgeCounts) {
    embed.fields.unshift(
      formatFieldHeading('Account'),
      {
        name: 'Points',
        value: user.points.toLocaleString(),
        inline: true,
      },
      {
        name: 'Joined',
        value: time(new Date(user.joined), 'D'),
        inline: true,
      },
      {
        name: 'Badges',
        value: Object.values(JSON.parse(user.badgeCounts) as Record<string, number>)
          .reduce((total, count) => (total as number) + (count as number))
          .toLocaleString(),
        inline: true,
      },
      {
        name: 'Videos Watched',
        value: user.countVideosCompleted.toLocaleString(),
        inline: true,
      }
    )
  } else embed.fields.unshift(formatFieldWarning('This user has chosen to keep some of their information private.'))

  return embed
}

function createComponents(profileData: ProfileData) {
  return [
    new MessageActionRow().addComponents(
      new MessageButton() //
        .setEmoji('👥')
        .setLabel('Profile')
        .setStyle('LINK')
        .setURL(profileURL(profileData.info.data.user!.username, profileData.info.data.user!.kaid))
    ),
  ]
}

type ProfileData = NonNullable<Awaited<ReturnType<typeof getProfileData>>>
