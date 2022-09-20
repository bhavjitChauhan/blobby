import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework'
import { codeBlock, isNullish } from '@sapphire/utilities'
import { MessageAttachment, MessageEmbed, ModalSubmitInteraction } from 'discord.js'
import { RUN_ENVIRONMENTS, RUN_PJS_OPTIONS_KEYS } from '../../lib/constants'
import { launch } from 'puppeteer'
import type { AceAjaxEditorElement } from '../../types'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { Stopwatch } from '@sapphire/stopwatch'
import { Time } from '@sapphire/time-utilities'
import { clamp, deserialize, pluralize, unescapeHTML } from '../../lib/utils/general'
import { formatStopwatch } from '../../lib/utils/discord'

export class ModalHandler extends InteractionHandler {
  public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    })
  }
  public override async parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('pjs')) return this.none()

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply()
    const code = interaction.fields.getTextInputValue('input')
    const options = deserialize(interaction.customId.replace('pjs', ''), RUN_PJS_OPTIONS_KEYS)

    options.width = clamp(parseInt(typeof options.width === 'string' ? options.width : '400'), 1, 5e3)
    options.height = clamp(parseInt(typeof options.height === 'string' ? options.height : '400'), 1, 5e3)
    options.delay = clamp(parseFloat(typeof options.delay === 'string' ? options.delay : '0'), 0, Time.Minute)
    options.canvas = options.canvas ?? true
    options.loopProtector = options.loopProtector ?? true

    return this.some({ code, ...(options as unknown as RunOptionsPJS) })
  }
  public async run(interaction: ModalSubmitInteraction, data: InteractionHandler.ParseResult<this>) {
    const { code, ...options } = data
    if (isNullish(code) || code.trim().length === 0) return interaction.editReply('No code provided')

    const stopwatch = new Stopwatch()
    const { success, image, logs, errors } = await this.eval(code, options)
    stopwatch.stop()

    const embed = new MessageEmbed()
      .setColor(success ? 'GREEN' : 'RED')
      .setTitle(`${RUN_ENVIRONMENTS['pjs']} Output`)
      .setFooter({ text: formatStopwatch(stopwatch) })

    if (Array.isArray(logs) && logs.length) {
      const tail = logs.slice(-10)
      let description = ''
      do {
        if (logs.length > 10) description = tail.length > 1 ? `Showing last ${tail.length} logs:\n` : 'Only showing last log:\n'
        description += codeBlock('js', tail.join('\n'))
      } while (description.length > EmbedLimits.MaximumDescriptionLength / 4 && tail.shift())
      if (tail.length == 0) description = `${pluralize('Log is', logs.length, 'Logs are')} too long to be displayed.`
      embed.setDescription(description)
    }

    let attachment = null
    if (success && image instanceof Uint8Array) {
      attachment = new MessageAttachment(Buffer.from(image as Uint8Array), 'screenshot.png')
      embed.setImage('attachment://screenshot.png')
    }
    if (!success) {
      const error = Array.isArray(errors)
        ? (errors[0].infiniteLoopNodeType && 'Your javascript is taking too long to run.') ?? errors[0].text ?? 'Unknown error'
        : 'Unknown error'
      embed.addFields({ name: 'Error', value: unescapeHTML(error) })
    }

    return interaction.editReply({ embeds: [embed], files: attachment ? [attachment] : [] })
  }
  private async eval(code: string, options: RunOptionsPJS) {
    let success = null,
      image = null,
      logs = null,
      errors = null

    const browser = await launch()
    try {
      const page = await browser.newPage()
      // Disable editor since it's not needed
      await page.goto(`https://www.khanacademy.org/computer-programming/new/pjs?editor=no&width=${options.width}&height=${options.height}`)

      // Wait for editor element and output frame
      await page.waitForSelector('.ace_editor')
      await page.waitForSelector('#output-frame')

      // Get output frame
      const frameHandle = await page.$('#output-frame')
      if (!frameHandle) throw new Error('Could not find output-frame')
      const frame = await frameHandle.contentFrame()
      if (!frame) throw new Error('Could not resolve contentFrame')
      await frameHandle.dispose()

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

      if (!options.loopProtector)
        await frame.evaluate(() => {
          window.LoopProtector.prototype.leave = null
        })

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

      // Wait for user-specified delay if any
      if (options.delay) await page.waitForTimeout(options.delay)

      if (options.canvas) {
        // Get the canvas element in the output frame
        await frame.waitForSelector('#output-canvas')
        const canvasHandle = await frame.$('#output-canvas')
        if (!canvasHandle) throw new Error('Could not find output-canvas')
        // Get the image data from the canvas as a string
        const str = await canvasHandle.evaluate((canvasElement) => {
          const canvas = canvasElement as HTMLCanvasElement
          const uri = canvas.toDataURL()
          return uri.split(',')[1]
        })
        await canvasHandle.dispose()
        // Mimic `atob`
        const bytes = Buffer.from(str, 'base64').toString('binary')
        // Convert the string to a Uint8Array
        const arr = new Uint8Array(bytes.length)
        for (let i = 0, length = bytes.length; i < length; i++) {
          arr[i] = bytes.charCodeAt(i)
        }
        image = arr
      }

      // Get any logs from the output frame
      logs = await frame.$$eval('body > div:nth-child(1) > div:nth-child(2) > div > div', (els) => els.map((el) => el.textContent ?? ''))
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

    return { success, image, logs, errors }
  }
}

interface RunOptionsPJS {
  width: number
  height: number
  delay: number
  canvas: boolean
  loopProtector: boolean
}
