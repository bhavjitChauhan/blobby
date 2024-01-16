import type { Events } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ChannelType, Message } from 'discord.js'
import config from '../config'
import { countTokens, generateResponse } from '../lib/ai'
import { MessageLimits } from '@sapphire/discord-utilities'

export class UserEvent extends Listener<typeof Events.MessageCreate> {
  public async run(message: Message) {
    if (message.channel.type !== ChannelType.DM || message.author.bot) return

    message.channel.sendTyping()

    const content = message.content.trim()

    const tokensCount = countTokens(content)
    if (tokensCount > config.ai.maxContextTokens) return message.channel.send('Your message is too long!')

    const response = await generateResponse(content).catch((err) => {
      console.error(err)
      return 'Something went wrong...'
    })

    const chunks = response.split('\n')
    for (let chunk of chunks) {
      if (chunk.trim().length === 0) continue
      if (chunk.length > MessageLimits.MaximumLength) {
        while (chunk && chunk.includes(' ')) chunk = chunk.slice(0, chunk.lastIndexOf(' '))

        if (chunk.length > MessageLimits.MaximumLength) {
          const subchunks = chunk.match(new RegExp(`(?:.|\\s){1,${MessageLimits.MaximumLength}}`, 'g'))
          if (subchunks) for (const subchunk of subchunks) await message.channel.send(subchunk)
        } else await message.channel.send(chunk)
      }
      await message.channel.send(chunk)
    }

    return
  }
}
