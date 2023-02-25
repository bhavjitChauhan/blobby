import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { khanClient } from '../../lib/khan-cookies'
import { profanity } from '@2toad/profanity'
import { ValidationError } from '../../lib/errors'
import { deferReply } from '../../lib/utils/discord'
import { userGet } from '../../lib/responses/userGet'
import { ErrorMessages } from '../../lib/constants'
import { KaidRegex } from '@bhavjit/khan-api'

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

    if (!KaidRegex.test(user)) {
      let profileInfo
      try {
        profileInfo = await khanClient.getUser(user)
      } catch (err) {
        if (err instanceof Error && err.message === 'User not found') throw new ValidationError(ErrorMessages.UserNotFound)
        else throw err
      }
      if (!profileInfo.kaid) throw new ValidationError(ErrorMessages.UserNotFound)
      user = profileInfo.kaid
    }

    let avatarData
    try {
      avatarData = await khanClient.getAvatar(user, 'png')
    } catch (err) {
      if (err instanceof Error && err.message === 'User not found') throw new ValidationError(ErrorMessages.UserNotFound)
      else throw err
    }

    return avatarData
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
