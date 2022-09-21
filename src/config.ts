import { Time } from '@sapphire/time-utilities'

export default {
  rateLimit: Time.Second,
  mongodb: {
    timeout: Time.Second * 15,
    limit: 100,
  },
  program: {
    discussionLimit: 100,
  },
  search: {
    resultsPerPage: 8,
  },
}
