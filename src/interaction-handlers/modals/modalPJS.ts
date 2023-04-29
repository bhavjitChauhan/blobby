import { InteractionHandler, InteractionHandlerTypes, type PieceContext } from '@sapphire/framework'
import type { ModalSubmitInteraction } from 'discord.js'
import { deserialize } from '../../lib/utils/general'
import { type RunOptionsPJS, runPJS } from '../../lib/responses/runPJS'
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
    if (!interaction.customId.startsWith(RunEnvironments.PJS)) return this.none()

    await deferReply(interaction)
    const code = interaction.fields.getTextInputValue('input')
    const options = deserialize(interaction.customId.replace(RunEnvironments.PJS, ''), RunEnvironmentOptionKeys[RunEnvironments.PJS])

    return this.some({ code, ...(options as unknown as RunOptionsPJS) })
  }

  public async run(interaction: ModalSubmitInteraction, parsedData: InteractionHandler.ParseResult<this>) {
    const { code, ...options } = parsedData

    await runPJS(interaction, code, options)
  }
}
