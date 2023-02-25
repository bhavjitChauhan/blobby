import { Client } from '@bhavjit/khan-api'

export const khanClient = new Client()

export let cookies: string[]

export const login = async function () {
  if (!process.env.KHAN_USERNAME || !process.env.KHAN_PASSWORD) throw new Error('Missing KHAN_USERNAME or KHAN_PASSWORD')
  await khanClient.login(process.env.KHAN_USERNAME, process.env.KHAN_PASSWORD)
}
