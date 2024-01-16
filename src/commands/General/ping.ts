import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { EmbedBuilder } from 'discord.js'
import { softAssertEnvVars } from '../../lib/env-parser'
import { getLatency } from '../../lib/mongodb/mongodb'
import { formatFieldHeading } from '../../lib/utils/discord'
import { ping } from '../../lib/utils/general'

softAssertEnvVars('ELASTICSEARCH_URI')

@ApplyOptions<Command.Options>({
  description: "Get the bot's latency",
  preconditions: ['UserRateLimit'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      {
        name: this.name,
        description: this.description,
      },
      { idHints: ['1012935998713368627', '1020204327178088559'] }
    )
  }

  private async embeds(interaction: Command.ChatInputCommandInteraction) {
    const message = await interaction.fetchReply()

    const createdTime = message.createdTimestamp
    const khanLatency = await ping('https://www.khanacademy.org/_fastly/flags')
    const mongoLatency = await getLatency()
    const elasticLatency = await ping(process.env.ELASTICSEARCH_URI as string)
    // const mongoLatencyStats = await latencyStats().catch((err) => {
    //   this.container.logger.error(err)
    //   return null
    // })

    const embed = new EmbedBuilder() //
      .setColor(khanLatency && mongoLatency ? 'Green' : 'Red')
      .setTitle('🏓 Pong!')
      .addFields(
        {
          name: 'Bot',
          value: `${Math.round(this.container.client.ws.ping).toLocaleString()}ms`,
          inline: true,
        },
        formatFieldHeading('APIs'),
        {
          name: 'Discord API',
          value: `${(createdTime - interaction.createdTimestamp).toLocaleString()}ms`,
          inline: true,
        },
        {
          name: 'Khan Academy API',
          value: khanLatency ? `${Math.round(khanLatency).toLocaleString()}ms` : '❓',
          inline: true,
        },
        formatFieldHeading('Services'),
        {
          name: 'MongoDB',
          value: mongoLatency ? `${Math.round(mongoLatency).toLocaleString()}ms` : '❓',
          inline: true,
        },
        {
          name: 'Elasticsearch',
          value: elasticLatency ? `${Math.round(elasticLatency).toLocaleString()}ms` : '❓',
          inline: true,
        }
      )

    return [embed]
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply()

    return interaction.editReply({
      embeds: await this.embeds(interaction),
    })
  }
}
