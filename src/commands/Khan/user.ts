import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { profile } from 'ka-api'
import { cookies } from '../../lib/khan-cookies'
import { profanity } from '@2toad/profanity'
import { bold, italic, time, underscore } from '@discordjs/builders'
import { FOOTER_SEPARATOR, ZERO_WIDTH_SPACE_CHAR } from '../../lib/constants'
import { pickRandom } from '../../lib/utils'
import { ValidationError } from '../../lib/errors'

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

  private async getProfile(interaction: Command.ChatInputInteraction) {
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

  private getProfileURL(profile: Profile) {
    return `https://www.khanacademy.org/profile/${profile.info.data.user!.username ?? profile.info.data.user!.kaid}`
  }

  private getAvatarURL(profile: Profile) {
    return `https://cdn.kastatic.org${profile.avatar.data.user!.avatar.imageSrc.replace('/svg', '').replace('.svg', '.png')}`
  }

  private getEmbeds(profile: Profile) {
    const embed = new MessageEmbed()
      .setColor('GREEN')
      .setTitle(profile.info.data.user!.nickname)
      .setURL(this.getProfileURL(profile))
      .setThumbnail(this.getAvatarURL(profile))
      .setDescription(profile.info.data.user!.bio)
      .addFields(
        {
          name: ZERO_WIDTH_SPACE_CHAR,
          value: underscore(bold('Programs')),
        },
        {
          name: 'Programs Created',
          value: profile.programs.scratchpads.length.toLocaleString(),
          inline: true,
        },
        {
          name: 'Votes Received',
          value: profile.programs.scratchpads.reduce((a, b) => a + b.sumVotesIncremented - 1, 0).toLocaleString(),
          inline: true,
        },
        {
          name: 'Spin-Offs Received',
          value: profile.programs.scratchpads.reduce((a, b) => a + Math.abs(b.spinoffCount), 0).toLocaleString(),
          inline: true,
        },
        {
          name: 'Votes Given',
          value: profile.widgets.data!.userSummary!.statistics.votes.toLocaleString(),
          inline: true,
        },
        {
          name: ZERO_WIDTH_SPACE_CHAR,
          value: underscore(bold('Discussion')),
        },
        {
          name: 'Questions',
          value: profile.widgets.data!.userSummary!.statistics.questions.toLocaleString(),
          inline: true,
        },
        {
          name: 'Answers',
          value: profile.widgets.data!.userSummary!.statistics.answers.toLocaleString(),
          inline: true,
        },
        {
          name: 'Help Requests',
          value: profile.widgets.data!.userSummary!.statistics.projectquestions.toLocaleString(),
          inline: true,
        },
        {
          name: 'Help Replies',
          value: profile.widgets.data!.userSummary!.statistics.projectanswers.toLocaleString(),
          inline: true,
        },
        {
          name: 'Tips & Thanks',
          value: profile.widgets.data!.userSummary!.statistics.comments.toLocaleString(),
          inline: true,
        },
        {
          name: 'Replies',
          value: profile.widgets.data!.userSummary!.statistics.replies.toLocaleString(),
          inline: true,
        }
      )
      .setFooter({
        text: `${typeof profile.info.data.user!.username === 'string' ? '@' + profile.info.data.user!.username + FOOTER_SEPARATOR : ''}${
          profile.info.data.user!.kaid
        }`,
        iconURL: this.getAvatarURL(profile),
      })

    if (profile.info.data.user!.joined && profile.info.data.user!.badgeCounts) {
      embed.fields.unshift(
        {
          name: ZERO_WIDTH_SPACE_CHAR,
          value: underscore(bold('Account')),
          inline: false,
        },
        {
          name: 'Points',
          value: profile.info.data.user!.points.toLocaleString(),
          inline: true,
        },
        {
          name: 'Joined',
          value: time(new Date(profile.info.data.user!.joined), 'D'),
          inline: true,
        },
        {
          name: 'Badges',
          value: Object.values(JSON.parse(profile.info.data.user!.badgeCounts) as Record<string, number>)
            .reduce((total, count) => (total as number) + (count as number))
            .toLocaleString(),
          inline: true,
        },
        {
          name: 'Videos Watched',
          value: profile.info.data.user!.countVideosCompleted.toLocaleString(),
          inline: true,
        }
      )
    } else
      embed.fields.unshift({
        name: italic('Warning'),
        value: italic('This user has chosen to keep some of their information private.'),
        inline: false,
      })

    return [embed]
  }

  private getComponents(profile: Profile) {
    return [
      new MessageActionRow().addComponents(
        new MessageButton() //
          .setEmoji(pickRandom(['🚹', '🚺', '🚼']))
          .setLabel('Profile')
          .setStyle('LINK')
          .setURL(this.getProfileURL(profile))
      ),
    ]
  }

  public async chatInputRun(interaction: Command.ChatInputInteraction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply()

    let profile
    try {
      profile = await this.getProfile(interaction)
    } catch (err) {
      if (err instanceof ValidationError) return interaction.editReply(err.message)
      else throw err
    }

    return await interaction.editReply({
      embeds: this.getEmbeds(profile),
      components: this.getComponents(profile),
    })
  }
}

type Profile = Awaited<ReturnType<UserCommand['getProfile']>>
