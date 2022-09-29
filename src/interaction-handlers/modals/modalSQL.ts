import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework'
import type { ModalSubmitInteraction } from 'discord.js'
import { deserialize } from '../../lib/utils/general'
import { runSQL } from '../../lib/responses/runSQL'
import { deferReply } from '../../lib/utils/discord'
import { RunEnvironmentOptionKeys, RunEnvironments } from '../../lib/constants'

export class ModalHandler extends InteractionHandler {
  public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    })
  }
  public override async parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith(RunEnvironments.SQL)) return this.none()

    await deferReply(interaction)
    const code = interaction.fields.getTextInputValue('input')
    const options = deserialize(interaction.customId.replace(RunEnvironments.SQL, ''), RunEnvironmentOptionKeys[RunEnvironments.SQL])

    return this.some({ code, ...(options as unknown as RunOptionsSQL) })
  }
  public async run(interaction: ModalSubmitInteraction, data: InteractionHandler.ParseResult<this>) {
    const { code, ...options } = data

    await runSQL(interaction, code, options)
  }
}

export interface RunOptionsSQL {
  width: number
  height: number
}
