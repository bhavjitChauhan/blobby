import { ApplyOptions } from '@sapphire/decorators'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { Command } from '@sapphire/framework'
import { Stopwatch } from '@sapphire/stopwatch'
import Type from '@sapphire/type'
import { isThenable } from '@sapphire/utilities'
import { EmbedBuilder } from 'discord.js'
import { inspect } from 'util'
import { parseEnvArray } from '../../lib/env-parser'
import { deferReply, formatStopwatch } from '../../lib/utils/discord'
import { truncate } from '../../lib/utils/general'

import { client as _elasticsearchClient } from '../../lib/elasticsearch'
import { khanClient as _khanClient } from '../../lib/khan-cookies'
import { client as _mongoClient } from '../../lib/mongodb/mongodb'

const ADMIN_GUILDS = parseEnvArray('ADMIN_GUILDS')

@ApplyOptions<Command.Options>({
  description: 'Evaluate JavaScript code',
  preconditions: ['AdminOnly'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option //
              .setName('code')
              .setDescription('What code should I evaluate?')
              .setRequired(true)
          ),
      {
        idHints: ['1082602820307533824'],
        guildIds: ADMIN_GUILDS,
      }
    )
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await deferReply(interaction)

    const stopwatch = new Stopwatch()

    const code = interaction.options.getString('code', true)

    const { result, success, type } = await this.eval(code)
    const embed = this.createEmbed(result, success, type, stopwatch)

    return interaction.editReply({ embeds: [embed] })
  }

  private createEmbed(result: string, success: boolean, type: string, stopwatch: Stopwatch) {
    return new EmbedBuilder() //
      .setColor(success ? 'Green' : 'Red')
      .setTitle('Eval')
      .setDescription(
        `\`\`\`js\n${truncate(result, EmbedLimits.MaximumDescriptionLength - 10, (remaining) => `\n${remaining.length} chars remaining...`)}\n\`\`\``
      )
      .addFields({
        name: 'Type',
        value: `\`\`\`js\n${truncate(type, EmbedLimits.MaximumFieldValueLength - 10)}\n\`\`\``,
      })
      .setFooter({ text: formatStopwatch(stopwatch) })
  }

  private async eval(code: string) {
    let result = null,
      success = true
    try {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      // @ts-expect-error value is never read
      const khanClient = _khanClient
      // @ts-expect-error value is never read
      const mongoClient = _mongoClient
      // @ts-expect-error value is never read
      const elasticsearchClient = _elasticsearchClient
      /* eslint-enable @typescript-eslint/no-unused-vars */
      result = eval(code)
    } catch (err) {
      result = err
      success = false
    }

    if (isThenable(result)) result = await result
    const type = new Type(result).toString()

    if (typeof result !== 'string') {
      result = inspect(result, {
        depth: 1,
      })
    }

    return { result, success, type }
  }
}
