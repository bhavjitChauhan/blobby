import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js'
import { profile, utils } from 'ka-api'
import { cookies } from '../../lib/khan-cookies'
import { profanity } from '@2toad/profanity'
import { time } from '@discordjs/builders'
import { ValidationError } from '../../lib/errors'
import { deferReply, formatFieldHeading, formatFieldWarning, formatStopwatch } from '../../lib/utils/discord'
import { avatarURL, displayNameFooter, profileURL } from '../../lib/utils/khan'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { truncate } from '../../lib/utils/general'
import { Stopwatch } from '@sapphire/stopwatch'
import { BULLET_SEPARATOR } from '../../lib/constants'

@ApplyOptions<Subcommand.Options>({
  description: 'Get info about a Khan Academy user',
  preconditions: ['UserRateLimit'],
  subcommands: [
    {
      name: 'get',
      chatInputRun: 'chatInputGet',
    },
    {
      name: 'avatar',
      chatInputRun: 'chatInputAvatar',
    },
  ],
})
export class UserCommand extends Subcommand {
  readonly #INAPPROPRIATE_USER = "I can't search for that user"
  readonly #PROFILE_NOT_FOUND = "I couldn't find that user"

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('get')
              .setDescription('Get profile info about a Khan Academy user')
              .addStringOption((option) =>
                option //
                  .setName('user')
                  .setDescription('The username or kaid of the user')
                  .setRequired(true)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('avatar')
              .setDescription("Get a Khan Academy user's avatar")
              .addStringOption((option) =>
                option //
                  .setName('user')
                  .setDescription('The username or kaid of the user')
                  .setRequired(true)
              )
          ),
      { idHints: ['1013219228171644948', '1020204331158478848'] }
    )
  }

  private async getProfileData(interaction: Subcommand.ChatInputInteraction) {
    const user = interaction.options.getString('user', true) as string
    if (profanity.exists(user)) throw new ValidationError(this.#INAPPROPRIATE_USER)

    const profileInfo = await profile.getProfileInfo(cookies, user)
    if (profileInfo.data.user === null) throw new ValidationError(this.#PROFILE_NOT_FOUND)

    const [profileWidgets, avatarData, userPrograms] = await Promise.all([
      profile.getProfileWidgets(cookies, profileInfo.data.user.kaid),
      profile.avatarDataForProfile(cookies, profileInfo.data.user.kaid),
      profile.getUserPrograms(profileInfo.data.user.kaid),
    ])

    if (!profileWidgets.data || profileWidgets.data.userSummary === null || avatarData.data.user === null)
      throw new ValidationError(this.#PROFILE_NOT_FOUND)

    return { info: profileInfo, widgets: profileWidgets, avatar: avatarData, programs: userPrograms }
  }

  private async getAvatarURL(interaction: Subcommand.ChatInputInteraction) {
    let user = interaction.options.getString('user', true) as string
    if (profanity.exists(user)) throw new ValidationError(this.#INAPPROPRIATE_USER)

    try {
      utils.isValidKaid(user)
    } catch {
      const profileInfo = await profile.getProfileInfo(cookies, user)
      if (profileInfo.data.user === null) throw new ValidationError(this.#PROFILE_NOT_FOUND)
      user = profileInfo.data.user.kaid
    }

    const avatarData = await profile.avatarDataForProfile(cookies, user)
    if (avatarData.data.user === null) throw new ValidationError(this.#PROFILE_NOT_FOUND)

    return avatarURL(avatarData.data.user.avatar.imageSrc)
  }

  private embeds(profileData: ProfileData) {
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

    return [embed]
  }

  private components(profileData: ProfileData) {
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

  public async chatInputGet(interaction: Subcommand.ChatInputInteraction) {
    await deferReply(interaction)

    const stopwatch = new Stopwatch()

    let profileData
    try {
      profileData = await this.getProfileData(interaction)
    } catch (err) {
      if (err instanceof ValidationError) {
        await interaction.editReply(err.message)
        return
      } else throw err
    }

    const embeds = this.embeds(profileData)
    embeds[0].setFooter({
      text: [embeds[0].footer!.text, formatStopwatch(stopwatch)].join(BULLET_SEPARATOR),
      iconURL: embeds[0].footer!.iconURL,
    })
    await interaction.editReply({
      embeds: embeds,
      components: this.components(profileData),
    })
  }

  public async chatInputAvatar(interaction: Subcommand.ChatInputInteraction) {
    await deferReply(interaction)

    let avatarURL
    try {
      avatarURL = await this.getAvatarURL(interaction)
    } catch (err) {
      if (err instanceof ValidationError) {
        await interaction.editReply(err.message)
        return
      } else throw err
    }

    await interaction.editReply(avatarURL)
  }
}

type ProfileData = Awaited<ReturnType<UserCommand['getProfileData']>>
