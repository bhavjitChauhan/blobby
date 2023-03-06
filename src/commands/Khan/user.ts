import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { khanClient } from '../../lib/khan-cookies'
import { deferReply } from '../../lib/utils/discord'
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
  readonly #OPTION_DESCRIPTION_USER = "What's the username or KAID of the user?"

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('get')
              .setDescription('Get general info about a user')
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
              .addStringOption((option) =>
                option //
                  .setName('type')
                  .setDescription('What image format should I use?')
                  .addChoices(
                    {
                      name: 'SVG',
                      value: 'svg',
                    },
                    {
                      name: 'PNG (default)',
                      value: 'png',
                    }
                  )
              )
          ),
      { idHints: ['1013219228171644948', '1020204331158478848'] }
    )
  }

  public async chatInputGet(interaction: Subcommand.ChatInputCommandInteraction) {
    const user = interaction.options.getString('user', true)

    await userGet(interaction, user)
  }

  public async chatInputAvatar(interaction: Subcommand.ChatInputCommandInteraction) {
    await deferReply(interaction)

    let avatarURL
    try {
      const user = interaction.options.getString('user', true),
        type = interaction.options.getString('type', false) ?? 'png'
      avatarURL = await khanClient.getAvatar(user, type as 'png' | 'svg')
    } catch (err) {
      await interaction.editReply(ErrorMessages.UserNotFound)
      throw err
    }

    await interaction.editReply(avatarURL)
  }
}
