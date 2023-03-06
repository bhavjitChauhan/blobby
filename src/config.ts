import { Time } from '@sapphire/time-utilities'

export default {
  support: '163437468522250240',
  rateLimit: Time.Second * 5,
  timeout: Time.Second * 15,
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
      max: 1000,
      default: 400,
    },
    height: {
      min: 1,
      max: 1000,
      default: 400,
    },
    delay: {
      min: 0,
      max: Time.Minute,
    },
    animation: {
      fps: 15,
      duration: Time.Second * 5,
      maxWidth: 600,
      maxHeight: 600,
      quality: 15,
    },
  },
  resultsPerPage: 8,
}
