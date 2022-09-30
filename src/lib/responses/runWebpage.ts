import type { ModalSubmitInteraction } from 'discord.js'
import { ButtonInteraction, MessageAttachment, MessageEmbed } from 'discord.js'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { isNullish } from '@sapphire/utilities'
import { evaluate } from '../puppeteer'
import { formatStopwatch } from '../utils/discord'
import { unescapeHTML } from '../utils/general'
import { RunEnvironments, RunEnvironmentTitles } from '../constants'
import config from '../../config'

export async function runWebpage(
  interaction: Subcommand.ChatInputInteraction | ButtonInteraction | ModalSubmitInteraction,
  code: string,
  partialOptions: Partial<RunOptionsWebpage>
) {
  if (isNullish(code) || code.trim().length === 0) return interaction.editReply('No code provided')

  const options = {
    ...DefaultRunOptionsWebpage,
    ...partialOptions,
  }

  const {
    success,
    error,
    stopwatch,
    data: { buffer },
  } = await evaluate(RunEnvironments.Webpage, code, options.width, options.height, null, async (frameHandle, data) => {
    data.buffer = await frameHandle.screenshot()
  })

  const embed = new MessageEmbed()
    .setColor(success ? 'GREEN' : 'RED')
    .setTitle(`${RunEnvironmentTitles[RunEnvironments.Webpage]} Output`)
    .setFooter({ text: formatStopwatch(stopwatch) })

  if (!success) embed.addFields({ name: 'Error', value: unescapeHTML(error ?? 'Unknown error.') })

  let attachment = null
  if (success && Buffer.isBuffer(buffer)) {
    attachment = new MessageAttachment(buffer, 'screenshot.png')
    embed.setImage('attachment://screenshot.png')
  }

  return interaction.editReply({ embeds: [embed], files: attachment ? [attachment] : [] })
}

export const DefaultRunOptionsWebpage: RunOptionsWebpage = {
  width: config.run.width.default,
  height: config.run.height.default,
  boilerplate: true,
}

export interface RunOptionsWebpage {
  width: number
  height: number
  boilerplate: boolean
}
