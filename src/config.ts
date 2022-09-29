import { Time } from '@sapphire/time-utilities'

export default {
  rateLimit: Time.Second * 5,
  mongodb: {
    timeout: Time.Minute,
    limit: 100,
  },
  program: {
    discussionLimit: 100,
  },
  run: {
    width: {
      min: 400,
      max: 5000,
      default: 400,
    },
    height: {
      min: 1,
      max: 5000,
      default: 400,
    },
    delay: {
      min: 0,
      max: Time.Minute,
    },
    animation: {
      delay: Time.Second / 15,
      duration: Time.Second * 5,
    },
  },
  search: {
    resultsPerPage: 8,
  },
}
