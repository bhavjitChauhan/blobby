import { deferReply } from '../utils/discord'
import { parseProgram } from '../utils/khan'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { AcceptedRunEnvironments, ErrorMessages, RunEnvironments } from '../constants'
import { programs } from 'ka-api'
import type { ButtonInteraction } from 'discord.js'
import { truncate } from '../utils/general'
import { AttachmentLimits } from '../utils/limits'

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
  const extension = AcceptedRunEnvironments.includes(type) ? RunEnvironmentExtensions[type as RunEnvironments] : 'txt'

  await interaction.editReply({
    files: [
      { attachment: Buffer.from(code), name: `${truncate(slug, AttachmentLimits.MaximumFilenameLength - (extension.length + 1), '')}.${extension}` },
    ],
  })
}

async function getScratchpadData(id: number) {
  const data = await programs.getProgramJSON(id, { slug: 1, userAuthoredContentType: 1, revision: { code: 1 } }).catch((reason) => {
    if (reason.response?.status === 404) return null
    else throw reason
  })
  if (data === null) return null

  return {
    slug: data.slug,
    type: data.userAuthoredContentType,
    code: data.revision.code,
  }
}

const RunEnvironmentExtensions: Record<RunEnvironments, string> = {
  [RunEnvironments.PJS]: 'js',
  [RunEnvironments.Webpage]: 'html',
  [RunEnvironments.SQL]: 'sql',
}
