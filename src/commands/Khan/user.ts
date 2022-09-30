import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { profile, utils } from 'ka-api'
import { cookies } from '../../lib/khan-cookies'
import { profanity } from '@2toad/profanity'
import { ValidationError } from '../../lib/errors'
import { deferReply } from '../../lib/utils/discord'
import { avatarURL } from '../../lib/utils/khan'
import { userGet } from '../../lib/responses/userGet'

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

  public async chatInputGet(interaction: Subcommand.ChatInputInteraction) {
    const user = interaction.options.getString('user', true)

    await userGet(interaction, user)
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
