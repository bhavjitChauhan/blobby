import { codeBlock, isNullish } from '@sapphire/utilities'
import { MessageAttachment, MessageEmbed, ModalSubmitInteraction } from 'discord.js'
import { formatStopwatch } from '../utils/discord'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { pluralize, unescapeHTML, waitForTimeout } from '../utils/general'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { evaluate } from '../puppeteer'
import { RunEnvironments, RunEnvironmentTitles } from '../constants'
import { GifEncoder } from '@skyra/gifenc'
import config from '../../config'
import consumers from 'node:stream/consumers'
import { createCanvas, loadImage } from 'canvas'
import { Time } from '@sapphire/time-utilities'

export async function runPJS(interaction: ModalSubmitInteraction | Subcommand.ChatInputInteraction, code: string, options: RunOptionsPJS) {
  if (isNullish(code) || code.trim().length === 0) return interaction.editReply('No code provided')

  const {
    success,
    error,
    stopwatch,
    data: { buffer, logs },
  } = await evaluate(
    RunEnvironments.PJS,
    code,
    options.width,
    options.height,
    async (frameHandle) => {
      if (!options.loopProtector) {
        const frame = await frameHandle.contentFrame()
        if (!frame) throw new Error('Could not resolve output frame')

        await frame.evaluate(() => {
          window.LoopProtector.prototype.leave = null
        })
      }
    },
    async (frameHandle, data) => {
      // Wait for any user-specified delay
      if (options.delay) await waitForTimeout(options.delay)

      const frame = await frameHandle.contentFrame()
      if (!frame) throw new Error('Could not resolve content frame')
      if (options.canvas) {
        // Get the canvas element in the output frame
        await frame.waitForSelector('#output-canvas')
        const canvasHandle = await frame.$('#output-canvas')
        if (!canvasHandle) throw new Error('Could not find output canvas')

        if (options.animated) {
          const start = Date.now(),
            urls = []
          let previous = start
          while (Date.now() - start < config.run.animation.duration) {
            const url = await canvasHandle.evaluate((canvasElement) => {
              const canvas = canvasElement as HTMLCanvasElement
              return canvas.toDataURL()
            })
            urls.push(url)

            await waitForTimeout(Math.max(0, Time.Second / config.run.animation.fps - (Date.now() - previous)))
            previous = Date.now()
          }

          const canvas = createCanvas(options.width, options.height),
            ctx = canvas.getContext('2d')

          const encoder = new GifEncoder(options.width, options.height)
          const stream = encoder.createReadStream()
          encoder //
            .setRepeat(0)
            // .setDelay(Time.Second / config.run.animation.fps)
            .setFramerate(config.run.animation.fps)
            .setQuality(config.run.animation.quality)
            .start()

          for (const url of urls) {
            const image = await loadImage(url)
            ctx.drawImage(image, 0, 0)
            const arr = ctx.getImageData(0, 0, options.width, options.height).data
            encoder.addFrame(arr)
          }
          encoder.finish()

          data.buffer = await consumers.buffer(stream)
        } else {
          // Get the image data from the canvas as a string
          const encoded = await canvasHandle.evaluate((canvasElement) => {
            const canvas = canvasElement as HTMLCanvasElement
            const uri = canvas.toDataURL()
            return uri.split(',')[1]
          })
          await canvasHandle.dispose()
          data.buffer = Buffer.from(encoded, 'base64')
        }
      }

      data.logs = await frame.$$eval('body > div:nth-child(1) > div:nth-child(2) > div > div', (els) => els.map((el) => el.textContent ?? ''))
    }
  )

  const embed = new MessageEmbed()
    .setColor(success ? 'GREEN' : 'RED')
    .setTitle(`${RunEnvironmentTitles[RunEnvironments.PJS]} Output`)
    .setFooter({ text: formatStopwatch(stopwatch) })

  if (!success) embed.addFields({ name: 'Error', value: unescapeHTML(error ?? 'Unknown error.') })

  let attachment
  if (success && buffer instanceof Buffer) {
    const filename = `canvas.${options.animated ? 'gif' : 'png'}`
    attachment = new MessageAttachment(buffer, filename)
    embed.setImage(`attachment://${filename}`)
  }

  if (logs && Array.isArray(logs) && logs.length) {
    const tail = logs.slice(-10)
    let description = ''
    do {
      if (logs.length > 10) description = tail.length > 1 ? `Showing last ${tail.length} logs:\n` : 'Only showing last log:\n'
      description += codeBlock('js', tail.join('\n'))
    } while (description.length > EmbedLimits.MaximumDescriptionLength / 4 && tail.shift())
    if (tail.length == 0) description = `${pluralize('Log is', logs.length, 'Logs are')} too long to be displayed.`
    embed.setDescription(description)
  } else if (success && !options.canvas) {
    embed.setDescription('No logs!')
  }

  return interaction.editReply({ embeds: [embed], files: attachment ? [attachment] : [] })
}

export interface RunOptionsPJS {
  width: number
  height: number
  delay: number
  loopProtector: boolean
  canvas: boolean
  animated: boolean
}
