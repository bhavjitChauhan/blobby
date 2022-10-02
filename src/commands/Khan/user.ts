import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { profile, utils } from 'ka-api'
import { cookies } from '../../lib/khan-cookies'
import { profanity } from '@2toad/profanity'
import { ValidationError } from '../../lib/errors'
import { deferReply } from '../../lib/utils/discord'
import { avatarURL } from '../../lib/utils/khan'
import { userGet } from '../../lib/responses/userGet'
import { ErrorMessages } from '../../lib/constants'

@ApplyOptions<Subcommand.Options>({
  description: 'Get topics about a Khan Academy user',
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
  readonly #OPTION_DESCRIPTION_USER = "What's the username or ID of the user?"

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('get')
              .setDescription('Get general topics about a user')
              .addStringOption((option) =>
                option //
                  .setName('user')
                  .setDescription(this.#OPTION_DESCRIPTION_USER)
                  .setRequired(true)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('avatar')
              .setDescription("Get a user's avatar")
              .addStringOption((option) =>
                option //
                  .setName('user')
                  .setDescription(this.#OPTION_DESCRIPTION_USER)
                  .setRequired(true)
              )
          ),
      { idHints: ['1013219228171644948', '1020204331158478848'] }
    )
  }

  private async getAvatarURL(interaction: Subcommand.ChatInputInteraction) {
    let user = interaction.options.getString('user', true) as string
    if (profanity.exists(user)) throw new ValidationError(ErrorMessages.InappropriateUser)

    try {
      utils.isValidKaid(user)
    } catch {
      const profileInfo = await profile.getProfileInfo(cookies, user)
      if (profileInfo.data.user === null) throw new ValidationError(ErrorMessages.UserNotFound)
      user = profileInfo.data.user.kaid
    }

    const avatarData = await profile.avatarDataForProfile(cookies, user)
    if (avatarData.data.user === null) throw new ValidationError(ErrorMessages.UserNotFound)

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
