import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { send } from '@sapphire/plugin-editable-commands'
import { Message } from 'discord.js'

@ApplyOptions<Command.Options>({
  description: "Get the bot's latency",
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      {
        name: this.name,
        description: this.description,
      },
      { idHints: ['1012935998713368627'] }
    )
  }

  public async messageRun(message: Message) {
    const msg = await send(message, 'Ping?')

    const content = `Pong! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${
      (msg.editedTimestamp || msg.createdTimestamp) - (message.editedTimestamp || message.createdTimestamp)
    }ms.`

    return send(message, content)
  }
  public async chatInputRun(interaction: Command.ChatInputInteraction) {
    const msg = await interaction.reply({ content: 'Ping?', fetchReply: true })
    const createdTime = msg instanceof Message ? msg.createdTimestamp : Date.parse(msg.timestamp)

    const content = `Pong! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${createdTime - interaction.createdTimestamp}ms.`

    return await interaction.editReply({
      content: content,
    })
  }
}
