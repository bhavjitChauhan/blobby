import { AllFlowsPrecondition } from '@sapphire/framework'
import type { CommandInteraction, ContextMenuCommandInteraction, Message, Snowflake } from 'discord.js'
import { parseEnvArray } from '../lib/env-parser'

const ADMINS = parseEnvArray('ADMINS')

export class UserPrecondition extends AllFlowsPrecondition {
  #message = 'This command can only be used by an admin.'

  public override chatInputRun(interaction: CommandInteraction) {
    return this.doAdminCheck(interaction.user.id)
  }

  public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
    return this.doAdminCheck(interaction.user.id)
  }

  public override messageRun(message: Message) {
    return this.doAdminCheck(message.author.id)
  }

  private doAdminCheck(userId: Snowflake) {
    return ADMINS.includes(userId) ? this.ok() : this.error({ message: this.#message })
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    AdminOnly: never
  }
}
