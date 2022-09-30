import type { ButtonInteraction } from 'discord.js'
import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework'
import { userGet } from '../../lib/responses/userGet'

export class ButtonHandler extends InteractionHandler {
  public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    })
  }
  public override parse(interaction: ButtonInteraction) {
    const [command, subcommand, user] = interaction.customId.split('-')
    if (command !== 'user' || subcommand !== 'get') return this.none()
    return this.some(user)
  }
  public async run(interaction: ButtonInteraction, user: InteractionHandler.ParseResult<this>) {
    await userGet(interaction, user)
  }
}
