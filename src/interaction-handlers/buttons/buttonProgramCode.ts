import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import { programCode } from '../../lib/responses/programCode'

export class ButtonHandler extends InteractionHandler {
  public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    })
  }

  public override parse(interaction: ButtonInteraction) {
    const [command, subcommand, id] = interaction.customId.split('-')
    if (command !== 'program' || subcommand !== 'code') return this.none()
    return this.some(id)
  }

  public async run(interaction: ButtonInteraction, id: InteractionHandler.ParseResult<this>) {
    await programCode(interaction, id)
  }
}
