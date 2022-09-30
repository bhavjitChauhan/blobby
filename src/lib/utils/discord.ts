import { bold, hyperlink, italic } from '@discordjs/builders'
import { EmbedLimits } from '@sapphire/discord-utilities'
import type { ChatInputCommandSuccessPayload, Command, ContextMenuCommandSuccessPayload, MessageCommandSuccessPayload } from '@sapphire/framework'
import { ChatInputCommand, container } from '@sapphire/framework'
import { send } from '@sapphire/plugin-editable-commands'
import type { Stopwatch } from '@sapphire/stopwatch'
import { cyan } from 'colorette'
import type { APIUser } from 'discord-api-types/v9'
import { ButtonInteraction, EmbedField, Guild, Message, MessageEmbed, ModalSubmitInteraction, User } from 'discord.js'
import { RandomLoadingMessage, ZERO_WIDTH_SPACE_CHAR } from '../constants'
import { pickRandom, truncate } from './general'
import Interaction = ChatInputCommand.Interaction

export function extractFileType(contentType: string | null) {
  if (contentType === null) return null
  return contentType.split(';')[0]
}

export function hyperlinkSilent(content: string, url: string) {
  return hyperlink(content, `<${url}>`)
}

/**
 * Sends a loading message to the current channel
 * @param message The message data for which to send the loading message
 */
export function sendLoadingMessage(message: Message): Promise<typeof message> {
  return send(message, {
    embeds: [
      new MessageEmbed() //
        .setDescription(pickRandom(RandomLoadingMessage))
        .setColor('#FF0000'),
    ],
  })
}

export function logSuccessCommand(payload: ContextMenuCommandSuccessPayload | ChatInputCommandSuccessPayload | MessageCommandSuccessPayload): void {
  let successLoggerData: ReturnType<typeof getSuccessLoggerData>

  if ('interaction' in payload) {
    successLoggerData = getSuccessLoggerData(payload.interaction.guild, payload.interaction.user, payload.command)
  } else {
    successLoggerData = getSuccessLoggerData(payload.message.guild, payload.message.author, payload.command)
  }

  container.logger.debug(`${successLoggerData.shard} - ${successLoggerData.commandName} ${successLoggerData.author} ${successLoggerData.sentAt}`)
}

export function getSuccessLoggerData(guild: Guild | null, user: User, command: Command) {
  const shard = getShardInfo(guild?.shardId ?? 0)
  const commandName = getCommandInfo(command)
  const author = getAuthorInfo(user)
  const sentAt = getGuildInfo(guild)

  return { shard, commandName, author, sentAt }
}

function getShardInfo(id: number) {
  return `[${cyan(id.toString())}]`
}

function getCommandInfo(command: Command) {
  return cyan(command.name)
}

function getAuthorInfo(author: User | APIUser) {
  return `${author.username}[${cyan(author.id)}]`
}

function getGuildInfo(guild: Guild | null) {
  if (guild === null) return 'Direct Messages'
  return `${guild.name}[${cyan(guild.id)}]`
}

export function extractCodeBlock(content: string) {
  const regex = /```(?:(\w+)\n)?\s*([^]+?)\s*```/i
  const match = regex.exec(content)
  if (!match) return null
  return match[2]
}

export function extractCodeLine(content: string) {
  const regex = /`([^`]+)`/i
  const match = regex.exec(content)
  if (!match) return null
  return match[1]
}

export function extractCode(content: string) {
  return extractCodeBlock(content) ?? extractCodeLine(content) ?? content
}

export function deferReply(interaction: Interaction | ButtonInteraction | ModalSubmitInteraction) {
  if (interaction.deferred) return
  if (interaction.replied) return
  return interaction.deferReply()
}

export function formatFieldHeading(heading: string): EmbedField {
  return {
    name: ZERO_WIDTH_SPACE_CHAR,
    value: truncate(bold(heading.toUpperCase()), EmbedLimits.MaximumFieldValueLength),
    inline: false,
  }
}

export function formatFieldWarning(warning: string): EmbedField {
  return {
    name: italic('Warning'),
    value: truncate(italic(warning), EmbedLimits.MaximumFieldValueLength),
    inline: false,
  }
}

export function formatStopwatch(stopwatch: Stopwatch) {
  if (stopwatch.running) stopwatch.stop()
  let emoji
  if (stopwatch.duration < 1000) emoji = '⚡'
  else if (stopwatch.duration < 5000) emoji = '🚀'
  else if (stopwatch.duration < 15000) emoji = '🐢'
  else emoji = '🐌'

  return `Took ${stopwatch.toString()} ${emoji}`
}
