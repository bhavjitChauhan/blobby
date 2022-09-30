import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { programs } from 'ka-api'
import { deferReply } from '../../lib/utils/discord'
import { parseProgram } from '../../lib/utils/khan'
import { programCode } from '../../lib/responses/programCode'
import { programGet } from '../../lib/responses/programGet'
import { ErrorMessages } from '../../lib/constants'

@ApplyOptions<Subcommand.Options>({
  description: 'Get info about a Khan Academy program',
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
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('get')
              .setDescription('Get general information about a program')
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription('The ID or URL of the program')
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
                  .setDescription('The ID or URL of the program')
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
                  .setDescription('The ID or URL of the program')
                  .setRequired(true)
              )
          ),
      { idHints: ['1014333490877173890', '1020204328277000212'] }
    )
  }

  private async getScratchpadThumbnailURL(id: number) {
    const data = await programs.getProgramJSON(id, { imageUrl: 1 }).catch((reason) => {
      if (reason.response?.status === 404) return null
      else throw reason
    })
    if (data === null) return null

    return data.imageUrl
  }

  public async chatInputGet(interaction: Subcommand.ChatInputInteraction) {
    const program = interaction.options.getString('program', true)
    await programGet(interaction, program)
  }

  public async chatInputCode(interaction: Subcommand.ChatInputInteraction) {
    const program = interaction.options.getString('program', true)
    await programCode(interaction, program)
  }

  public async chatInputThumbnail(interaction: Subcommand.ChatInputInteraction) {
    await deferReply(interaction)

    const program = interaction.options.getString('program', true)
    const id = parseProgram(program)
    if (id === null) {
      await interaction.editReply(ErrorMessages.InvalidProgramID)
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
