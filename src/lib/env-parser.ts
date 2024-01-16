import { isNullishOrEmpty } from '@sapphire/utilities'

export function softAssertEnvVars(...keys: string[]) {
  for (const key of keys) if (isNullishOrEmpty(process.env[key])) console.warn(`[ENV] ${key} - The key is empty or undefined.`)
}

export function parseEnvArray(key: 'ADMINS' | 'ADMIN_GUILDS', defaultValue?: string[]): string[] {
  const value = process.env[key]
  if (isNullishOrEmpty(value)) {
    if (defaultValue === undefined) throw new Error(`[ENV] ${key} - The key must be an array, but is empty or undefined.`)
    return defaultValue
  }

  return value.split(' ')
}
