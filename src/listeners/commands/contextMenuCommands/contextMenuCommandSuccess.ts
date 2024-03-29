import { type ContextMenuCommandSuccessPayload, Listener, LogLevel } from '@sapphire/framework'
import type { Logger } from '@sapphire/plugin-logger'
import { logSuccessCommand } from '../../../lib/utils/discord'

export class UserListener extends Listener {
  public run(payload: ContextMenuCommandSuccessPayload) {
    logSuccessCommand(payload)
  }

  public onLoad() {
    this.enabled = (this.container.logger as Logger).level <= LogLevel.Debug
    return super.onLoad()
  }
}
