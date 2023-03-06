import type { ButtonInteraction } from 'discord.js'
import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework'
import { userPrograms } from '../../lib/responses/userPrograms'

export class ButtonHandler extends InteractionHandler {
  public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    })
  }
  public override parse(interaction: ButtonInteraction) {
    const [command, subcommand, user] = interaction.customId.split('-')
    if (command !== 'user' || subcommand !== 'programs') return this.none()
    return this.some(user)
  }
  public run(interaction: ButtonInteraction, identifier: InteractionHandler.ParseResult<this>) {
    return userPrograms(interaction, identifier)
  }
}
