import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework'
import { isNullish } from '@sapphire/utilities'
import { MessageAttachment, MessageEmbed, ModalSubmitInteraction } from 'discord.js'
import { RUN_ENVIRONMENTS, RUN_SQL_OPTIONS_KEYS } from '../../lib/constants'
import { launch } from 'puppeteer'
import type { AceAjaxEditorElement } from '../../types'
import { Stopwatch } from '@sapphire/stopwatch'
import { deserialize, clamp, unescapeHTML } from '../../lib/utils/general'
import { formatStopwatch } from '../../lib/utils/discord'

export class ModalHandler extends InteractionHandler {
  public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    })
  }
  public override async parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('sql')) return this.none()

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply()
    const code = interaction.fields.getTextInputValue('input')
    const options = deserialize(interaction.customId.replace('sql', ''), RUN_SQL_OPTIONS_KEYS)

    options.width = clamp(typeof options.width === 'number' ? options.width : 400, 1, 5e3)
    options.height = clamp(typeof options.height === 'number' ? options.height : 400, 1, 5e3)
    options.boilerplate = options.boilerplate ?? true

    return this.some({ code, ...(options as unknown as RunOptionsSQL) })
  }
  public async run(interaction: ModalSubmitInteraction, data: InteractionHandler.ParseResult<this>) {
    const { code, ...options } = data
    if (isNullish(code) || code.trim().length === 0) return interaction.editReply('No code provided')

    const stopwatch = new Stopwatch()
    const { success, image, errors } = await this.eval(code, options)
    stopwatch.stop()

    const embed = new MessageEmbed()
      .setColor(success ? 'GREEN' : 'RED')
      .setTitle(`${RUN_ENVIRONMENTS['sql']} Output`)
      .setFooter({ text: formatStopwatch(stopwatch) })

    let attachment = null
    if (success && Buffer.isBuffer(image)) {
      attachment = new MessageAttachment(image, 'screenshot.png')
      embed.setImage('attachment://screenshot.png')
    }
    if (!success) {
      const error = Array.isArray(errors) ? errors[0].text ?? 'Unknown error' : 'Unknown error'
      embed.addFields({ name: 'Error', value: unescapeHTML(error) })
    }

    return interaction.editReply({ embeds: [embed], files: attachment ? [attachment] : [] })
  }
  private async eval(code: string, options: RunOptionsSQL) {
    let success = null,
      image = null,
      errors = null

    const browser = await launch()
    try {
      const page = await browser.newPage()
      // Disable editor since it's not needed
      await page.goto(`https://www.khanacademy.org/computer-programming/new/sql?editor=no&width=${options.width}&height=${options.height}`)

      // Wait for editor element and output frame
      await page.waitForSelector('.ace_editor')
      await page.waitForSelector('#output-frame')

      // Get output frame
      const frameHandle = await page.$('#output-frame')
      if (!frameHandle) throw new Error('Could not find output-frame')
      const frame = await frameHandle.contentFrame()
      if (!frame) throw new Error('Could not resolve contentFrame')

      // Add event listener for when the code is done running
      await page.evaluate((code) => {
        window.addEventListener('message', ({ data }) => {
          const { results } = JSON.parse(data)
          // Ensure the message is for the current code
          if (results.code == code) {
            window._runDone = true
            window._errors = results.errors
          }
        })
      }, code)

      // Get editor element
      const editorHandle = await page.$('.ace_editor')
      if (!editorHandle) throw new Error('Could not find editor')
      // Set editor value to code
      await editorHandle.evaluate((handle, code) => {
        ;(handle as AceAjaxEditorElement).env.editor.setValue(code)
      }, code)
      await editorHandle.dispose()

      // Wait for the code to run
      await page.waitForFunction(() => window._runDone)
      errors = (await page.evaluate(() => window._errors)) ?? []

      image = await frameHandle.screenshot()
      await frameHandle.dispose()

      // Evaluation was only successful if there were no errors
      success = errors.length === 0
    } catch (err) {
      if (err && err instanceof Error && err.stack) {
        this.container.client.logger.error(err)
      } else {
        this.container.client.logger.error('Unknown error', err)
      }
      success = false
    } finally {
      await browser.close()
    }

    return { success, image, errors }
  }
}

export interface RunOptionsSQL {
  width: number
  height: number
}
