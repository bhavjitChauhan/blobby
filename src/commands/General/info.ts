import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import type { ApplicationCommandOptionChoiceData } from 'discord.js'
import { AutoCompleteLimits, MessageLimits } from '@sapphire/discord-utilities'
import { italic, userMention } from '@discordjs/builders'
import config from '../../config'
import { InfoTopic, parseInfoTopics } from '../../lib/info-topics-parser'
import { BULLET_CHAR, rootDir } from '../../lib/constants'
import path from 'path'
import { hyperlinkSilent } from '../../lib/utils/discord'
import { truncate } from '../../lib/utils/general'

const topics = parseInfoTopics(path.join(rootDir, 'data', 'topics'))

@ApplyOptions<Command.Options>({
  description: 'Look up common topics about programming on Khan Academy',
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
              .setDescription('What should I send topics about?')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addUserOption((option) =>
            option //
              .setName('mention')
              .setDescription('Should I tell anyone in particular?')
          ),
      { idHints: ['1025325503357390909', '1025290775094890547'] }
    )
  }

  public autocompleteRun(interaction: Command.AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true),
      query = focusedOption.value.toLowerCase()

    let results: InfoTopic[] = []
    if (focusedOption.name === 'topic') {
      results = results.concat(topics.filter((topic) => topic.data.keywords.includes(query)))
      results = results.concat(topics.filter((topic) => topic.data.keywords.find((keyword) => keyword.includes(query))))
      // noinspection JSVoidFunctionReturnValueUsed
      results = results.concat(topics.filter((topic) => topic.content.toLowerCase().includes(query)))
    }

    results = [...new Set(results)]
    if (results.length > AutoCompleteLimits.MaximumAmountOfOptions) results.splice(AutoCompleteLimits.MaximumAmountOfOptions)
    const options: ApplicationCommandOptionChoiceData[] = results.map((result) => ({ name: result.data.title, value: result.data.title }))
    return interaction.respond(options)
  }

  public async chatInputRun(interaction: Command.ChatInputInteraction) {
    const title = interaction.options.getString('topic', true),
      mention = interaction.options.getUser('mention')

    const topic = topics.find((topic) => topic.data.title === title) as InfoTopic,
      data = topic.data
    let content = topic.content
    content = content.replace(/\[(.+?)]\((.+?)\)/g, (_match, content, url) => hyperlinkSilent(content, url)).trim()
    if (data.resources) {
      const learnMoreLine = `\n\n${italic('Learn more:')}`
      if (content.length + learnMoreLine.length >= MessageLimits.MaximumLength) {
        this.container.logger.warn(`Topic ${title} content was too long to add any resources`)
        return
      }
      content += learnMoreLine
      for (const resource of data.resources) {
        const resourceLine = `\n${BULLET_CHAR} ${hyperlinkSilent(resource.name, resource.url)}`
        if (content.length + resourceLine.length >= MessageLimits.MaximumLength) {
          this.container.logger.warn(`Topic ${title} content was too long to add resources after ${resource.name}`)
          break
        }
        content += resourceLine
      }
    }
    if (!content)
      return interaction.reply({
        content: `Sorry, I don't know anything about that topic yet. If you want to share what you know let ${userMention(config.support)} know.`,
        ephemeral: true,
      })

    if (content.length > MessageLimits.MaximumLength) {
      this.container.logger.warn(`Topic ${title} content was too long to send without truncating`)
      content = truncate(content, MessageLimits.MaximumLength, '\n' + italic('Message was too long...'))
    }

    return interaction.reply(`${mention ? userMention(mention.id) + '\n' : ''}${content}`)
  }
}
