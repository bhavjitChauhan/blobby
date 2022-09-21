import { AllFlowsPrecondition } from '@sapphire/framework'
import { cyan } from 'colorette'
import type { CommandInteraction, ContextMenuInteraction, Message, User } from 'discord.js'
import { rateLimitManager } from '../lib/rate-limits'

export class UserPrecondition extends AllFlowsPrecondition {
  #message = 'Slow down with the commands!'

  public override chatInputRun(interaction: CommandInteraction) {
    return this.doUserRateLimitCheck(interaction.user, interaction)
  }

  public override contextMenuRun(interaction: ContextMenuInteraction) {
    return this.doUserRateLimitCheck(interaction.user, interaction)
  }

  public override messageRun(message: Message) {
    return this.doUserRateLimitCheck(message.author, message)
  }

  private doUserRateLimitCheck(user: User, interaction: CommandInteraction | ContextMenuInteraction | Message) {
    const rateLimit = rateLimitManager.acquire(user.id)
    if (rateLimit.limited) {
      this.container.logger.debug(
        `Rate limited ${user.username}[${cyan(user.id)}] ${interaction.guild?.name ?? 'Unknown'}[${cyan(interaction.guild?.id ?? 'DM')}]`
      )
      return this.error({ message: this.#message })
    } else {
      rateLimit.consume()
      return this.ok()
    }
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    UserRateLimit: never
  }
}
