import { ButtonInteraction, AttachmentBuilder, EmbedBuilder, ModalSubmitInteraction } from 'discord.js'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { isNullish } from '@sapphire/utilities'
import { evaluate } from '../puppeteer'
import { formatStopwatch } from '../utils/discord'
import { unescapeHTML } from '../utils/general'
import { RunEnvironments, RunEnvironmentTitles } from '../constants'
import config from '../../config'

export async function runSQL(
  interaction: Subcommand.ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
  code: string,
  partialOptions: Partial<RunOptionsSQL>
) {
  if (isNullish(code) || code.trim().length === 0) return interaction.editReply('No code provided')

  const options = {
    ...DefaultRunOptionsSQL,
    ...partialOptions,
  }

  const {
    success,
    error,
    stopwatch,
    data: { buffer },
  } = await evaluate(RunEnvironments.SQL, code, options.width, options.height, null, async (frameHandle, data) => {
    data.buffer = await frameHandle.screenshot()
  })

  const embed = new EmbedBuilder()
    .setColor(success ? 'Green' : 'Red')
    .setTitle(`${RunEnvironmentTitles[RunEnvironments.SQL]} Output`)
    .setFooter({ text: formatStopwatch(stopwatch) })

  if (!success) embed.addFields({ name: 'Error', value: unescapeHTML(error ?? 'Unknown error.') })

  let attachment = null
  if (success && Buffer.isBuffer(buffer)) {
    attachment = new AttachmentBuilder(buffer, { name: 'screenshot.png' })
    embed.setImage('attachment://screenshot.png')
  }

  return interaction.editReply({ embeds: [embed], files: attachment ? [attachment] : [] })
}

export const DefaultRunOptionsSQL: RunOptionsSQL = {
  width: config.run.width.default,
  height: config.run.height.default,
}

export interface RunOptionsSQL {
  width: number
  height: number
}
