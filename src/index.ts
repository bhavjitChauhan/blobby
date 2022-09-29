import './lib/setup'
import { LogLevel, SapphireClient } from '@sapphire/framework'
import { login } from './lib/khan-cookies'

export const client = new SapphireClient({
  logger: {
    level: LogLevel.Debug,
  },
  shards: 'auto',
  intents: ['GUILDS'],
  partials: ['CHANNEL'],
  loadMessageCommandListeners: true,
})

const main = async () => {
  try {
    client.logger.info('Logging into Discord...')
    await client.login()
    client.logger.info('Logged into Discord...')
    client.logger.info('Logging into Khan Academy...')
    await login()
    client.logger.info('Logged into Khan Academy')
  } catch (error) {
    client.logger.fatal(error)
    client.destroy()
    process.exit(1)
  }
}

main()
