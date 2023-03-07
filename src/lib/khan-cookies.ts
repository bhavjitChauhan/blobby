import { Client } from '@bhavjit/khan-api'
import { assertEnvVars } from './env-parser'

assertEnvVars('KHAN_USERNAME', 'KHAN_PASSWORD')
process.env.KHAN_USERNAME = process.env.KHAN_USERNAME as string
process.env.KHAN_PASSWORD = process.env.KHAN_PASSWORD as string

export const khanClient = new Client()

export let cookies: string[]

export const login = async function () {
  await khanClient.login(process.env.KHAN_USERNAME, process.env.KHAN_PASSWORD)
}
