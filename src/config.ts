import { Time } from '@sapphire/time-utilities'

export default {
  rateLimit: 1000,
  mongodb: {
    timeout: Time.Minute,
    limit: 100,
  },
  program: {
    discussionLimit: 100,
  },
  search: {
    resultsPerPage: 8,
  },
}
