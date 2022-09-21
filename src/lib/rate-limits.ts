import { RateLimitManager } from '@sapphire/ratelimits'
import config from '../config'

export const rateLimitManager = new RateLimitManager(config.rateLimit)
