import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { profile } from 'ka-api'
import { cookies } from '../../lib/khan-cookies'
import { profanity } from '@2toad/profanity'
import { time } from '@discordjs/builders'
import { FOOTER_SEPARATOR } from '../../lib/constants'
import { ValidationError } from '../../lib/errors'
import { formatFieldHeading, formatFieldWarning } from '../../lib/utils'

@ApplyOptions<Command.Options>({
  description: "Get a Khan Academy user's profile",
})
export class UserCommand extends Command {
  readonly #INAPPROPRIATE_USER = "I can't search for that user"
  readonly #PROFILE_NOT_FOUND = "I couldn't find that user"

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option //
              .setName('user')
              .setDescription('The username or kaid of the user')
              .setRequired(true)
          ),
      { idHints: ['1013219228171644948'] }
    )
  }

  private async getProfileData(interaction: Command.ChatInputInteraction) {
    const user = interaction.options.getString('user', true) as string
    if (profanity.exists(user)) throw new ValidationError(this.#INAPPROPRIATE_USER)

    const profileInfo = await profile.getProfileInfo(cookies, user)
    if (profileInfo.data.user === null) throw new ValidationError(this.#PROFILE_NOT_FOUND)

    const profileWidgets = await profile.getProfileWidgets(cookies, profileInfo.data.user.kaid)
    if (!profileWidgets.data || profileWidgets.data.userSummary === null) throw new ValidationError(this.#PROFILE_NOT_FOUND)

    const avatarData = await profile.avatarDataForProfile(cookies, profileInfo.data.user.kaid)
    if (avatarData.data.user === null) throw new ValidationError(this.#PROFILE_NOT_FOUND)

    const userPrograms = await profile.getUserPrograms(profileInfo.data.user.kaid)

    return { info: profileInfo, widgets: profileWidgets, avatar: avatarData, programs: userPrograms }
  }

  private profileURL(profileData: ProfileData) {
    return `https://www.khanacademy.org/profile/${profileData.info.data.user!.username ?? profileData.info.data.user!.kaid}`
  }

  private avatarURL(profileData: ProfileData) {
    return `https://cdn.kastatic.org${profileData.avatar.data.user!.avatar.imageSrc.replace('/svg', '').replace('.svg', '.png')}`
  }

  private embeds(profileData: ProfileData) {
    const embed = new MessageEmbed()
      .setColor('GREEN')
      .setTitle(profileData.info.data.user!.nickname)
      .setURL(this.profileURL(profileData))
      .setThumbnail(this.avatarURL(profileData))
      .setDescription(profileData.info.data.user!.bio)
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
          value: profileData.widgets.data!.userSummary!.statistics.votes.toLocaleString(),
          inline: true,
        },
        formatFieldHeading('Discussion'),
        {
          name: 'Questions',
          value: profileData.widgets.data!.userSummary!.statistics.questions.toLocaleString(),
          inline: true,
        },
        {
          name: 'Answers',
          value: profileData.widgets.data!.userSummary!.statistics.answers.toLocaleString(),
          inline: true,
        },
        {
          name: 'Help Requests',
          value: profileData.widgets.data!.userSummary!.statistics.projectquestions.toLocaleString(),
          inline: true,
        },
        {
          name: 'Help Replies',
          value: profileData.widgets.data!.userSummary!.statistics.projectanswers.toLocaleString(),
          inline: true,
        },
        {
          name: 'Tips & Thanks',
          value: profileData.widgets.data!.userSummary!.statistics.comments.toLocaleString(),
          inline: true,
        },
        {
          name: 'Replies',
          value: profileData.widgets.data!.userSummary!.statistics.replies.toLocaleString(),
          inline: true,
        }
      )
      .setFooter({
        text:
          (typeof profileData.info.data.user!.username === 'string' ? '@' + profileData.info.data.user!.username + FOOTER_SEPARATOR : '') +
          profileData.info.data.user!.kaid,
        iconURL: this.avatarURL(profileData),
      })

    if (profileData.info.data.user!.joined && profileData.info.data.user!.badgeCounts) {
      embed.fields.unshift(
        formatFieldHeading('Account'),
        {
          name: 'Points',
          value: profileData.info.data.user!.points.toLocaleString(),
          inline: true,
        },
        {
          name: 'Joined',
          value: time(new Date(profileData.info.data.user!.joined), 'D'),
          inline: true,
        },
        {
          name: 'Badges',
          value: Object.values(JSON.parse(profileData.info.data.user!.badgeCounts) as Record<string, number>)
            .reduce((total, count) => (total as number) + (count as number))
            .toLocaleString(),
          inline: true,
        },
        {
          name: 'Videos Watched',
          value: profileData.info.data.user!.countVideosCompleted.toLocaleString(),
          inline: true,
        }
      )
    } else embed.fields.unshift(formatFieldWarning('This user has chosen to keep some of their information private.'))

    return [embed]
  }

  private components(profileData: ProfileData) {
    return [
      new MessageActionRow().addComponents(
        new MessageButton() //
          .setEmoji('👥')
          .setLabel('Profile')
          .setStyle('LINK')
          .setURL(this.profileURL(profileData))
      ),
    ]
  }

  public async chatInputRun(interaction: Command.ChatInputInteraction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply()

    let profileData
    try {
      profileData = await this.getProfileData(interaction)
    } catch (err) {
      if (err instanceof ValidationError) return interaction.editReply(err.message)
      else throw err
    }

    return interaction.editReply({
      embeds: this.embeds(profileData),
      components: this.components(profileData),
    })
  }
}

type ProfileData = Awaited<ReturnType<UserCommand['getProfileData']>>
