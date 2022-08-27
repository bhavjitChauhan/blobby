import type { ChatInputCommandSuccessPayload, Command, ContextMenuCommandSuccessPayload, MessageCommandSuccessPayload } from '@sapphire/framework'
import { container } from '@sapphire/framework'
import { send } from '@sapphire/plugin-editable-commands'
import { cyan } from 'colorette'
import type { APIUser } from 'discord-api-types/v9'
import { Guild, Message, MessageEmbed, User } from 'discord.js'
import { RandomLoadingMessage } from './constants'

/**
 * Picks a random item from an array
 * @param array The array to pick a random item from
 * @example
 * const randomEntry = pickRandom([1, 2, 3, 4]) // 1
 */
export function pickRandom<T>(array: readonly T[]): T {
  const { length } = array
  return array[Math.floor(Math.random() * length)]
}

/**
 * Sends a loading message to the current channel
 * @param message The message data for which to send the loading message
 */
export function sendLoadingMessage(message: Message): Promise<typeof message> {
  return send(message, { embeds: [new MessageEmbed().setDescription(pickRandom(RandomLoadingMessage)).setColor('#FF0000')] })
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

export function clamp(n: number, min: number, max: number) {
  return Math.max(Math.min(n, max), min)
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

export function serialize(obj: Record<string, boolean | number | string | null>, keys: Array<string>) {
  const arr = []
  for (const key of keys) if (key in obj) arr.push(obj[key])
  const str = JSON.stringify(arr)
  return str.substring(1, str.length - 1)
}

export function deserialize(str: string, keys: Array<string>) {
  const arr = JSON.parse(`[${str}]`)
  const obj: Record<string, boolean | number | string | null> = {}
  for (const [i, key] of keys.entries()) obj[key] = arr[i]
  return obj
}
