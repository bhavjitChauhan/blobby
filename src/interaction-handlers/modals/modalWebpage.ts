import { InteractionHandler, InteractionHandlerTypes, type PieceContext } from '@sapphire/framework'
import type { ModalSubmitInteraction } from 'discord.js'
import { deserialize } from '../../lib/utils/general'
import type { RunOptionsWebpage } from '../../lib/responses/runWebpage'
import { runWebpage } from '../../lib/responses/runWebpage'
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
    if (!interaction.customId.startsWith(RunEnvironments.Webpage)) return this.none()

    await deferReply(interaction)
    const code = interaction.fields.getTextInputValue('input')
    const options = deserialize(interaction.customId.replace(RunEnvironments.Webpage, ''), RunEnvironmentOptionKeys[RunEnvironments.Webpage])

    return this.some({ code, ...(options as unknown as RunOptionsWebpage) })
  }

  public async run(interaction: ModalSubmitInteraction, parsedData: InteractionHandler.ParseResult<this>) {
    const { code, ...options } = parsedData

    await runWebpage(interaction, options.boilerplate ? this.generateBoilerplate(code) : code, options)
  }

  private generateBoilerplate(html: string) {
    return `<!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>New webpage</title>
        </head>
        <body>
            ${html}
        </body>
    </html>
    `
  }
}
