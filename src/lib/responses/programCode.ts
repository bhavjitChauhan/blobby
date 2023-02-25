import { deferReply } from '../utils/discord'
import { parseProgram } from '../utils/khan'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { ErrorMessages, RunEnvironmentKhanApiMap, RunEnvironments } from '../constants'
import type { ButtonInteraction } from 'discord.js'
import { truncate } from '../utils/general'
import { AttachmentLimits } from '../utils/limits'
import { khanClient } from '../khan-cookies'

export async function programCode(interaction: Subcommand.ChatInputInteraction | ButtonInteraction, program: string) {
  await deferReply(interaction)

  const id = parseProgram(program)
  if (id === null) {
    await interaction.editReply(ErrorMessages.InvalidProgram)
    return
  }

  const data = await getScratchpadData(id)
  if (data === null) {
    await interaction.editReply(ErrorMessages.ProgramNotFound)
    return
  }

  const { slug, type, code } = data
  const extension = type ? RunEnvironmentExtensions[type] : 'txt'

  await interaction.editReply({
    files: [
      {
        attachment: Buffer.from(code),
        name: `${truncate(slug, AttachmentLimits.MaximumFilenameLength - (extension.length + 1), '')}.${extension}`,
      },
    ],
  })
}

async function getScratchpadData(id: number) {
  let data
  try {
    data = await khanClient.getProgram(id)
  } catch (err) {
    if (err instanceof Error && err.message === 'Program not found') data = null
    else throw err
  }

  if (data === null || !data.rawData || !data.rawData.url || !data.type || !data.code) return null

  const mappedType = RunEnvironmentKhanApiMap[data.type]

  return {
    slug: data.rawData.url.split('/')[2],
    type: mappedType,
    code: data.code,
  }
}

const RunEnvironmentExtensions: Record<RunEnvironments, string> = {
  [RunEnvironments.PJS]: 'js',
  [RunEnvironments.Webpage]: 'html',
  [RunEnvironments.SQL]: 'sql',
}
