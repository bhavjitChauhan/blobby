import { InteractionHandler, InteractionHandlerTypes, PieceContext } from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import { programs } from 'ka-api'
import { AcceptedRunEnvironments, ErrorMessages, RunEnvironments } from '../../lib/constants'
import { runPJS } from '../../lib/responses/runPJS'
import { runWebpage } from '../../lib/responses/runWebpage'
import { runSQL } from '../../lib/responses/runSQL'
import { deferReply } from '../../lib/utils/discord'

export class ButtonHandler extends InteractionHandler {
  public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    })
  }

  public override parse(interaction: ButtonInteraction) {
    const [command, environment, id] = interaction.customId.split('-')
    if (command !== 'run' || !AcceptedRunEnvironments.includes(environment)) return this.none()
    return this.some({ environment, id })
  }

  public async run(interaction: ButtonInteraction, parsedData: InteractionHandler.ParseResult<this>) {
    await deferReply(interaction)

    const { environment, id } = parsedData

    const data = await programs.getProgramJSON(id, { width: 1, height: 1, revision: { code: 1 } }).catch((reason) => {
      if (reason.response?.status === 404) return null
      else throw reason
    })
    if (!data) {
      await interaction.reply(ErrorMessages.ProgramNotFound)
      return
    }

    const code = data.revision.code,
      options = { width: data.width, height: data.height }

    switch (environment as RunEnvironments) {
      case RunEnvironments.PJS:
        await runPJS(interaction, code, options)
        break
      case RunEnvironments.Webpage:
        await runWebpage(interaction, code, options)
        break
      case RunEnvironments.SQL:
        await runSQL(interaction, code, options)
        break
    }
  }
}
