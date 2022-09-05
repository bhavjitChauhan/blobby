import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework'
import { isNullish } from '@sapphire/utilities'
import { MessageAttachment, MessageEmbed, ModalSubmitInteraction } from 'discord.js'
import { RUN_ENVIRONMENTS, RUN_HTML_OPTIONS_KEYS } from '../../lib/constants'
import { launch } from 'puppeteer'
import type { AceAjaxEditorElement } from '../../types'
import { Stopwatch } from '@sapphire/stopwatch'
import { clamp, deserialize } from '../../lib/utils/general'
import { formatStopwatch } from '../../lib/utils/discord'

export class ModalHandler extends InteractionHandler {
  public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    })
  }
  public override async parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('html')) return this.none()

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply()
    const html = interaction.fields.getTextInputValue('input')
    const options = deserialize(interaction.customId.replace('html', ''), RUN_HTML_OPTIONS_KEYS)

    options.width = clamp(typeof options.width === 'number' ? options.width : 400, 1, 5e3)
    options.height = clamp(typeof options.height === 'number' ? options.height : 400, 1, 5e3)
    options.boilerplate = options.boilerplate ?? true

    return this.some({ html, ...(options as unknown as RunOptionsHtml) })
  }
  public async run(interaction: ModalSubmitInteraction, data: InteractionHandler.ParseResult<this>) {
    const { html, ...options } = data
    if (isNullish(html) || html.trim().length === 0) return interaction.editReply('No HTML provided')

    const stopwatch = new Stopwatch()
    const { success, image, errors } = await this.eval(options.boilerplate ? this.generateBoilerplate(html) : html, options)
    stopwatch.stop()

    const embed = new MessageEmbed()
      .setColor(success ? 'GREEN' : 'RED')
      .setTitle(`${RUN_ENVIRONMENTS['html']} Output`)
      .setFooter({ text: formatStopwatch(stopwatch) })

    let attachment = null
    if (success && Buffer.isBuffer(image)) {
      attachment = new MessageAttachment(image, 'canvas.png')
      embed.setImage('attachment://canvas.png')
    }
    if (!success) {
      const error = Array.isArray(errors) ? errors[0].text ?? 'Unknown error' : 'Unknown error'
      embed.addFields({ name: 'Error', value: error })
    }

    return interaction.editReply({ embeds: [embed], files: attachment ? [attachment] : [] })
  }
  private async eval(html: string, options: RunOptionsHtml) {
    let success = null,
      image = null,
      errors = null

    const browser = await launch()
    try {
      const page = await browser.newPage()
      // Disable editor since it's not needed
      await page.goto(`https://www.khanacademy.org/computer-programming/new/webpage?editor=no&width=${options.width}&height=${options.height}`)

      // Wait for editor element and output frame
      await page.waitForSelector('.ace_editor')
      await page.waitForSelector('#output-frame')

      // Get output frame
      const frameHandle = await page.$('#output-frame')
      if (!frameHandle) throw new Error('Could not find output-frame')
      const frame = await frameHandle.contentFrame()
      if (!frame) throw new Error('Could not resolve contentFrame')

      // Add event listener for when the code is done running
      await page.evaluate((html) => {
        window.addEventListener('message', ({ data }) => {
          const { results } = JSON.parse(data)
          // Ensure the message is for the current code
          if (results.code == html) {
            window._runDone = true
            window._errors = results.errors
          }
        })
      }, html)

      // Get editor element
      const editorHandle = await page.$('.ace_editor')
      if (!editorHandle) throw new Error('Could not find editor')
      // Set editor value to code
      await editorHandle.evaluate((handle, html) => {
        ;(handle as AceAjaxEditorElement).env.editor.setValue(html)
      }, html)
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
  private generateBoilerplate(html: string) {
    return `<!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            <title>New webpage</title>
        </head>
        <body>
            ${html}
        </body>
    </html>
    `
  }
}

export interface RunOptionsHtml {
  width: number
  height: number
  boilerplate: boolean
}
