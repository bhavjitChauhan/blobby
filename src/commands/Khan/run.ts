import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { Modal, MessageActionRow, type ModalActionRowComponent, TextInputComponent } from 'discord.js'
import { RUN_PJS_OPTIONS_KEYS, RUN_ENVIRONMENTS, RUN_HTML_OPTIONS_KEYS, RUN_SQL_OPTIONS_KEYS } from '../../lib/constants'
import { serialize } from '../../lib/utils/general'

@ApplyOptions<Subcommand.Options>({
  description: 'Run code in the Khan Academy environment',
  preconditions: ['UserRateLimit'],
  subcommands: [
    {
      name: 'pjs',
      chatInputRun: 'chatInputPJS',
    },
    {
      name: 'html',
      chatInputRun: 'chatInputHtml',
    },
    {
      name: 'sql',
      chatInputRun: 'chatInputSQL',
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
              .setName('pjs')
              .setDescription('Runs Processing.js code in the Khan Academy environment')
              .addIntegerOption((option) =>
                option //
                  .setName('width')
                  .setDescription('Width of the canvas')
              )
              .addIntegerOption((option) =>
                option //
                  .setName('height')
                  .setDescription('Height of the canvas')
              )
              .addNumberOption((option) =>
                option //
                  .setName('delay')
                  .setDescription('Delay in milliseconds before the result is retrieved')
              )
              .addBooleanOption((option) =>
                option //
                  .setName('canvas')
                  .setDescription('Whether to show the canvas')
              )
              .addBooleanOption((option) =>
                option //
                  .setName('loop-protector')
                  .setDescription('Whether to enable the loop protector')
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('html')
              .setDescription('Runs HTML in the Khan Academy environment')
              .addIntegerOption((option) =>
                option //
                  .setName('width')
                  .setDescription('Width of the webpage')
              )
              .addIntegerOption((option) =>
                option //
                  .setName('height')
                  .setDescription('Height of the webpage')
              )
              .addBooleanOption((option) =>
                option //
                  .setName('boilerplate')
                  .setDescription('Whether to wrap HTML in boilerplate')
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('sql')
              .setDescription('Runs SQL code in the Khan Academy environment')
              .addIntegerOption((option) =>
                option //
                  .setName('width')
                  .setDescription('Width of the output')
              )
              .addIntegerOption((option) =>
                option //
                  .setName('height')
                  .setDescription('Height of the output')
              )
          ),
      { idHints: ['1013180516712857651', '1020204329111658577'] }
    )
  }

  public async chatInputPJS(interaction: Subcommand.ChatInputInteraction) {
    const options = {
      width: interaction.options.getInteger('width'),
      height: interaction.options.getInteger('height'),
      delay: interaction.options.getNumber('delay'),
      canvas: interaction.options.getBoolean('canvas'),
      loopProtector: interaction.options.getBoolean('loop-protector'),
    }
    const modal = this.createModal('pjs', options, RUN_PJS_OPTIONS_KEYS)

    await interaction.showModal(modal).catch((err) => this.container.client.logger.error(err))
  }

  public async chatInputHtml(interaction: Subcommand.ChatInputInteraction) {
    const options = {
      width: interaction.options.getInteger('width'),
      height: interaction.options.getInteger('height'),
      boilerplate: interaction.options.getBoolean('boilerplate'),
    }
    const modal = this.createModal('html', options, RUN_HTML_OPTIONS_KEYS)

    await interaction.showModal(modal).catch((err) => this.container.client.logger.error(err))
  }

  public async chatInputSQL(interaction: Subcommand.ChatInputInteraction) {
    const options = {
      width: interaction.options.getInteger('width'),
      height: interaction.options.getInteger('height'),
    }
    const modal = this.createModal('sql', options, RUN_SQL_OPTIONS_KEYS)

    await interaction.showModal(modal).catch((err) => this.container.client.logger.error(err))
  }

  private createModal(environment: string, options: Record<string, boolean | number | null>, keys: string[]) {
    const modal = new Modal()
      .setCustomId(`${environment}${serialize(options, keys)}`)
      .setTitle(`${RUN_ENVIRONMENTS[environment]} Input`)
      .setComponents(
        new MessageActionRow<ModalActionRowComponent>().addComponents(
          new TextInputComponent() //
            .setCustomId('input') // replace with 'input'
            .setLabel(environment == 'html' ? 'HTML' : 'Code')
            .setStyle('PARAGRAPH')
        )
      )
    return modal
  }
}
