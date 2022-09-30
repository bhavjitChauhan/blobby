import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import tags, { Tag } from '../../data/tags'
import type { ApplicationCommandOptionChoiceData } from 'discord.js'
import { AutoCompleteLimits } from '@sapphire/discord-utilities'
import { userMention } from '@discordjs/builders'
import config from '../../config'

@ApplyOptions<Command.Options>({
  description: 'Look up common info about programming on Khan Academy',
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
              .setName('topic')
              .setDescription('What should I send info about?')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addUserOption((option) =>
            option //
              .setName('mention')
              .setDescription('Should I tell anyone in particular?')
          ),
      { idHints: ['1025290775094890547'] }
    )
  }

  public autocompleteRun(interaction: Command.AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true),
      query = focusedOption.value.toLowerCase()

    let results: Tag[] = []
    if (focusedOption.name === 'topic') {
      results = results.concat(tags.filter((tag) => tag.keywords.includes(query)))
      results = results.concat(tags.filter((tag) => tag.keywords.find((keyword) => keyword.includes(query))))
      results = results.concat(tags.filter((tag) => tag.content.toLowerCase().includes(query)))
    }

    results = [...new Set(results)]
    if (results.length > AutoCompleteLimits.MaximumAmountOfOptions) results.splice(AutoCompleteLimits.MaximumAmountOfOptions)
    const options: ApplicationCommandOptionChoiceData[] = results.map((result) => ({ name: result.name, value: result.name }))
    return interaction.respond(options)
  }

  public async chatInputRun(interaction: Command.ChatInputInteraction) {
    const topic = interaction.options.getString('topic', true),
      mention = interaction.options.getUser('mention')
    const content = tags.find((tag) => tag.name === topic)?.content

    if (!content)
      return interaction.reply({
        content: `Sorry, I don't know anything about that topic yet. If you want to share what you know let ${userMention(config.support)} know.`,
        ephemeral: true,
      })

    return interaction.reply(`${mention ? userMention(mention.id) + ' ' : ''}${content}`)
  }
}
