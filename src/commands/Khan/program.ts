import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { deferReply } from '../../lib/utils/discord'
import { parseProgram } from '../../lib/utils/khan'
import { programCode } from '../../lib/responses/programCode'
import { programGet } from '../../lib/responses/programGet'
import { ErrorMessages } from '../../lib/constants'
import { khanClient } from '../../lib/khan-cookies'

@ApplyOptions<Subcommand.Options>({
  description: 'Get topics about a Khan Academy program',
  preconditions: ['UserRateLimit'],
  subcommands: [
    {
      name: 'get',
      chatInputRun: 'chatInputGet',
    },
    {
      name: 'code',
      chatInputRun: 'chatInputCode',
    },
    {
      name: 'thumbnail',
      chatInputRun: 'chatInputThumbnail',
    },
  ],
})
export class UserCommand extends Subcommand {
  readonly #OPTION_DESCRIPTION_PROGRAM = "What's the ID or URL of the program?"

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('get')
              .setDescription('Get general topics about a program')
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription(this.#OPTION_DESCRIPTION_PROGRAM)
                  .setRequired(true)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('code')
              .setDescription('Get the code of a program')
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription(this.#OPTION_DESCRIPTION_PROGRAM)
                  .setRequired(true)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('thumbnail')
              .setDescription('Get the thumbnail of a program')
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription(this.#OPTION_DESCRIPTION_PROGRAM)
                  .setRequired(true)
              )
          ),
      { idHints: ['1014333490877173890', '1020204328277000212'] }
    )
  }

  private async getScratchpadThumbnailURL(id: number) {
    let data
    try {
      data = await khanClient.getProgram(id)
    } catch (err) {
      if (err instanceof Error && err.message === 'Not Found') data = null
      else throw err
    }
    if (data === null) return null

    return data.thumbnailUrl
  }

  public async chatInputGet(interaction: Subcommand.ChatInputCommandInteraction) {
    const program = interaction.options.getString('program', true)
    await programGet(interaction, program)
  }

  public async chatInputCode(interaction: Subcommand.ChatInputCommandInteraction) {
    const program = interaction.options.getString('program', true)
    await programCode(interaction, program)
  }

  public async chatInputThumbnail(interaction: Subcommand.ChatInputCommandInteraction) {
    await deferReply(interaction)

    const program = interaction.options.getString('program', true)
    const id = parseProgram(program)
    if (id === null) {
      await interaction.editReply(ErrorMessages.InvalidProgram)
      return
    }

    const thumbnailURL = await this.getScratchpadThumbnailURL(id)
    if (thumbnailURL === null) {
      await interaction.editReply(ErrorMessages.ProgramNotFound)
      return
    }

    await interaction.editReply({ files: [{ attachment: thumbnailURL, name: 'thumbnail.png' }] })
  }
}
