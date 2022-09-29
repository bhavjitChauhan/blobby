import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { MessageActionRow, Modal, type ModalActionRowComponent, TextInputComponent } from 'discord.js'
import { clamp, serialize } from '../../lib/utils/general'
import { RunOptionsPJS, runPJS } from '../../lib/responses/runPJS'
import type { RunOptionsWebpage } from '../../lib/responses/runWebpage'
import { runWebpage } from '../../lib/responses/runWebpage'
import type { RunOptionsSQL } from '../../lib/responses/runSQL'
import { runSQL } from '../../lib/responses/runSQL'
import { deferReply, extractFileType } from '../../lib/utils/discord'
import { parseProgram } from '../../lib/utils/khan'
import { programs } from 'ka-api'
import config from '../../config'
import { RunEnvironmentOptionKeys, RunEnvironments, RunEnvironmentTitles } from '../../lib/constants'

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
      chatInputRun: 'chatInputWebpage',
    },
    {
      name: 'sql',
      chatInputRun: 'chatInputSQL',
    },
  ],
})
export class UserCommand extends Subcommand {
  readonly #UNSUPPORTED_FILE_TYPE = "I can't work with that type of file"
  readonly #FILE_FETCH_ERROR = "I couldn't get that file from Discord"
  readonly #INVALID_PROGRAM = "That doesn't look like a real program"
  readonly #PROGRAM_NOT_FOUND = "I couldn't find that program"
  readonly #INVALID_PROGRAM_TYPE = 'That looks like the wrong type of program'

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
                  .setName('loop-protector')
                  .setDescription('Whether to enable the loop protector')
              )
              .addBooleanOption((option) =>
                option //
                  .setName('canvas')
                  .setDescription('Whether to show the canvas')
              )
              .addBooleanOption((option) =>
                option //
                  .setName('animated')
                  .setDescription('Whether to record a GIF of the canvas')
              )
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription('The ID or URL of the program')
              )
              .addAttachmentOption((option) =>
                option //
                  .setName('file')
                  .setDescription('File to run')
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
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription('The ID or URL of the program')
              )
              .addAttachmentOption((option) =>
                option //
                  .setName('file')
                  .setDescription('File to run')
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
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription('The ID or URL of the program')
              )
              .addAttachmentOption((option) =>
                option //
                  .setName('file')
                  .setDescription('File to run')
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
      loopProtector: interaction.options.getBoolean('loop-protector'),
      canvas: interaction.options.getBoolean('canvas'),
      animated: interaction.options.getBoolean('animated'),
    }

    const program = interaction.options.getString('program')
    if (!program || options.width !== null) options.width = this.normalizeWidth(options.width)
    if (!program || options.height !== null) options.height = this.normalizeHeight(options.height)
    options.delay = clamp(options.delay !== null ? options.delay : config.run.delay.min, config.run.delay.min, config.run.delay.max)
    options.loopProtector = options.loopProtector ?? true
    options.canvas = options.canvas ?? true
    options.animated = options.animated ?? false

    await this.chatInput(interaction, RunEnvironments.PJS, options as RunOptionsPJS)
  }

  public async chatInputWebpage(interaction: Subcommand.ChatInputInteraction) {
    const options = {
      width: interaction.options.getInteger('width'),
      height: interaction.options.getInteger('height'),
      boilerplate: interaction.options.getBoolean('boilerplate'),
    }

    const file = interaction.options.getAttachment('file'),
      program = interaction.options.getString('program')
    if (!program || options.width !== null) options.width = this.normalizeWidth(options.width)
    if (!program || options.height !== null) options.height = this.normalizeHeight(options.height)
    options.boilerplate = file !== null || program !== null ? false : options.boilerplate ?? true

    await this.chatInput(interaction, RunEnvironments.Webpage, options as RunOptionsWebpage)
  }

  public async chatInputSQL(interaction: Subcommand.ChatInputInteraction) {
    const options = {
      width: interaction.options.getInteger('width'),
      height: interaction.options.getInteger('height'),
    }

    const program = interaction.options.getString('program')
    if (!program || options.width !== null) options.width = this.normalizeWidth(options.width)
    if (!program || options.height !== null) options.height = this.normalizeHeight(options.height)

    await this.chatInput(interaction, RunEnvironments.SQL, options as RunOptionsSQL)
  }

  private normalizeWidth(width: number | null) {
    if (width === null) return config.run.width.default
    return clamp(width, config.run.width.min, config.run.width.max)
  }

  private normalizeHeight(height: number | null) {
    if (height === null) return config.run.height.default
    return clamp(height, config.run.height.min, config.run.height.max)
  }

  private async chatInput(
    interaction: Subcommand.ChatInputInteraction,
    environment: RunEnvironments,
    options: RunOptionsPJS | RunOptionsWebpage | RunOptionsSQL
  ) {
    const file = interaction.options.getAttachment('file'),
      program = interaction.options.getString('program')
    if (file || program) {
      await deferReply(interaction)

      let code
      if (file) {
        if (
          !file.contentType ||
          !RunEnvironmentFileTypes[environment].includes(extractFileType(file.contentType) as string) ||
          typeof file.attachment !== 'string'
        ) {
          await interaction.reply(this.#UNSUPPORTED_FILE_TYPE)
          return
        }

        const response = await fetch(file.attachment)
        if (!response.ok) {
          await interaction.reply(this.#FILE_FETCH_ERROR)
          return
        }
        code = await response.text()
      } else {
        const id = parseProgram(program!)
        if (!id) {
          await interaction.reply(this.#INVALID_PROGRAM)
          return
        }

        const data = await programs.getProgramJSON(id, { width: 1, height: 1, userAuthoredContentType: 1, revision: { code: 1 } }).catch((reason) => {
          if (reason.response?.status === 404) return null
          else throw reason
        })
        if (!data) {
          await interaction.reply(this.#PROGRAM_NOT_FOUND)
          return
        }

        if (data.userAuthoredContentType !== environment) {
          await interaction.reply(this.#INVALID_PROGRAM_TYPE)
          return
        }

        if (options.width === null) options.width = data.width
        if (options.height === null) options.height = data.height
        code = data.revision.code
      }

      // @ts-expect-error options argument is not typed correctly
      await RunEnvironmentFunctions[environment](interaction, code, options)
    } else {
      const modal = this.createModal(environment, options)
      await interaction.showModal(modal)
    }
  }

  private createModal(environment: RunEnvironments, options: RunOptionsPJS | RunOptionsWebpage | RunOptionsSQL) {
    return new Modal()
      .setCustomId(`${environment}${serialize(options as unknown as Record<string, boolean | number>, RunEnvironmentOptionKeys[environment])}`)
      .setTitle(`${RunEnvironmentTitles[environment]} Input`)
      .setComponents(
        new MessageActionRow<ModalActionRowComponent>().addComponents(
          new TextInputComponent() //
            .setCustomId('input')
            .setLabel(environment == RunEnvironments.Webpage ? 'HTML' : 'Code')
            .setStyle('PARAGRAPH')
        )
      )
  }
}

const RunEnvironmentFileTypes: Record<RunEnvironments, string[]> = {
  [RunEnvironments.PJS]: ['text/plain', 'application/javascript'],
  [RunEnvironments.Webpage]: ['text/plain', 'text/html'],
  [RunEnvironments.SQL]: ['text/plain', 'application/x-sql'],
}

const RunEnvironmentFunctions: Record<RunEnvironments, typeof runPJS | typeof runWebpage | typeof runSQL> = {
  [RunEnvironments.PJS]: runPJS,
  [RunEnvironments.Webpage]: runWebpage,
  [RunEnvironments.SQL]: runSQL,
}
