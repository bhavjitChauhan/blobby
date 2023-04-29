import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js'
import { clamp, serialize } from '../../lib/utils/general'
import { type RunOptionsPJS, runPJS } from '../../lib/responses/runPJS'
import type { RunOptionsWebpage } from '../../lib/responses/runWebpage'
import { runWebpage } from '../../lib/responses/runWebpage'
import type { RunOptionsSQL } from '../../lib/responses/runSQL'
import { runSQL } from '../../lib/responses/runSQL'
import { deferReply, extractFileType } from '../../lib/utils/discord'
import { parseProgram } from '../../lib/utils/khan'
import config from '../../config'
import { ErrorMessages, RunEnvironmentKhanApiMap, RunEnvironmentOptionKeys, RunEnvironments, RunEnvironmentTitles } from '../../lib/constants'
import { khanClient } from '../../lib/khan-cookies'

@ApplyOptions<Subcommand.Options>({
  description: 'Run code on Khan Academy',
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
  readonly #OPTION_DESCRIPTION_PROGRAM = 'Give me a program ID or URL to run it instead'
  readonly #OPTION_DESCRIPTION_FILE = 'Give me a file to run it instead'

  readonly #UNSUPPORTED_FILE_TYPE = "I can't work with that type of file"
  readonly #FILE_FETCH_ERROR = "I couldn't get that file from Discord"
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
              .setDescription('Runs Processing.js code on Khan Academy')
              .addIntegerOption((option) =>
                option //
                  .setName('width')
                  .setDescription("What's the canvas width?")
              )
              .addIntegerOption((option) =>
                option //
                  .setName('height')
                  .setDescription('Whats the canvas height?')
              )
              .addBooleanOption((option) =>
                option //
                  .setName('loop-protector')
                  .setDescription('Should the loop detector be enabled?')
              )
              .addBooleanOption((option) =>
                option //
                  .setName('screenshot')
                  .setDescription('Should I take a screenshot of the canvas?')
              )
              .addNumberOption((option) =>
                option //
                  .setName('delay')
                  .setDescription('How long should I wait before taking the screenshot?')
              )
              .addBooleanOption((option) =>
                option //
                  .setName('animated')
                  .setDescription('Should I record a short GIF instead?')
              )
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription(this.#OPTION_DESCRIPTION_PROGRAM)
              )
              .addAttachmentOption((option) =>
                option //
                  .setName('file')
                  .setDescription(this.#OPTION_DESCRIPTION_FILE)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('html')
              .setDescription('Runs HTML on Khan Academy')
              .addIntegerOption((option) =>
                option //
                  .setName('width')
                  .setDescription("What's the webpage width?")
              )
              .addIntegerOption((option) =>
                option //
                  .setName('height')
                  .setDescription("What's the webpage height?")
              )
              .addBooleanOption((option) =>
                option //
                  .setName('boilerplate')
                  .setDescription('Should I wrap the HTML in some boilerplate?')
              )
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription(this.#OPTION_DESCRIPTION_PROGRAM)
              )
              .addAttachmentOption((option) =>
                option //
                  .setName('file')
                  .setDescription(this.#OPTION_DESCRIPTION_FILE)
              )
          )
          .addSubcommand((subcommand) =>
            subcommand //
              .setName('sql')
              .setDescription('Runs SQL on Khan Academy')
              .addIntegerOption((option) =>
                option //
                  .setName('width')
                  .setDescription("What's the output width?")
              )
              .addIntegerOption((option) =>
                option //
                  .setName('height')
                  .setDescription("What's the output height?")
              )
              .addStringOption((option) =>
                option //
                  .setName('program')
                  .setDescription(this.#OPTION_DESCRIPTION_PROGRAM)
              )
              .addAttachmentOption((option) =>
                option //
                  .setName('file')
                  .setDescription(this.#OPTION_DESCRIPTION_FILE)
              )
          ),
      { idHints: ['1013180516712857651', '1020204329111658577'] }
    )
  }

  public async chatInputPJS(interaction: Subcommand.ChatInputCommandInteraction) {
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
    if (options.animated) {
      if (options.width !== null && options.width > config.run.animation.maxWidth) options.width = config.run.width.default
      if (options.height !== null && options.height > config.run.animation.maxHeight) options.height = config.run.height.default
    }

    await this.chatInput(interaction, RunEnvironments.PJS, options as RunOptionsPJS)
  }

  public async chatInputWebpage(interaction: Subcommand.ChatInputCommandInteraction) {
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

  public async chatInputSQL(interaction: Subcommand.ChatInputCommandInteraction) {
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
    interaction: Subcommand.ChatInputCommandInteraction,
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
          typeof file.url !== 'string'
        ) {
          await interaction.reply(this.#UNSUPPORTED_FILE_TYPE)
          return
        }

        const response = await fetch(file.url)
        if (!response.ok) {
          await interaction.reply(this.#FILE_FETCH_ERROR)
          return
        }
        code = await response.text()
      } else {
        const id = parseProgram(program!)
        if (!id) {
          await interaction.reply(ErrorMessages.InvalidProgram)
          return
        }

        let data
        try {
          data = await khanClient.getProgram(id)
        } catch (err) {
          if (err instanceof Error && err.message === 'Program not found') await interaction.reply(ErrorMessages.InvalidProgram)
          else await interaction.reply(ErrorMessages.InvalidProgram)
          return
        }

        if (!data.type || !data.code) {
          await interaction.reply(ErrorMessages.InvalidProgram)
          return
        }
        const mappedType = RunEnvironmentKhanApiMap[data.type]
        if (mappedType !== environment) {
          await interaction.reply(this.#INVALID_PROGRAM_TYPE)
          return
        }

        if (options.width === null) options.width = data.width ?? config.run.width.default
        if (options.height === null) options.height = data.height ?? config.run.height.default
        code = data.code
      }

      await RunEnvironmentFunctions[environment](interaction, code, options)
    } else {
      const modal = this.createModal(environment, options)
      await interaction.showModal(modal)
    }
  }

  private createModal(environment: RunEnvironments, options: RunOptionsPJS | RunOptionsWebpage | RunOptionsSQL) {
    return new ModalBuilder()
      .setCustomId(`${environment}${serialize(options as unknown as Record<string, boolean | number>, RunEnvironmentOptionKeys[environment])}`)
      .setTitle(`${RunEnvironmentTitles[environment]} Input`)
      .setComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder() //
            .setCustomId('input')
            .setLabel(environment == RunEnvironments.Webpage ? 'HTML' : 'Code')
            .setStyle(TextInputStyle.Paragraph)
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
