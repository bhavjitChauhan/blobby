import { encoding_for_model } from 'tiktoken'
import { softAssertEnvVars } from './env-parser'

softAssertEnvVars('AI_URL', 'AI_AUTH')

export function countTokens(str: string) {
  const encoder = encoding_for_model('gpt-3.5-turbo')
  const tokens = encoder.encode(str)
  encoder.free()
  return tokens.length
}

export async function generateResponse(prompt: string): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: process.env.AI_AUTH as string,
  }

  const requestInit = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      prompt: prompt,
    }),
  }

  const response = await fetch(process.env.AI_URL as string, requestInit)
    .then((response) => response.json())
    .then((response) => response.result.response)

  return response
}
