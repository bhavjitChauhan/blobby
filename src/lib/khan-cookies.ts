import { auth } from 'ka-api'

export let cookies: string[]

export const login = async function () {
  if (!process.env.KHAN_USERNAME || !process.env.KHAN_PASSWORD) throw new Error('Missing KHAN_USERNAME or KHAN_PASSWORD')
  cookies = await auth.login(process.env.KHAN_USERNAME, process.env.KHAN_PASSWORD)
}
