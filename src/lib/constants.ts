import { join } from 'path'

export const rootDir = join(__dirname, '..', '..')
export const srcDir = join(rootDir, 'src')

export const EN_SPACE_CHAR = '\u2002'
export const ZERO_WIDTH_SPACE_CHAR = '\u200B'
export const BULLET_CHAR = '\u2022'

export const BULLET_SEPARATOR = `  ${BULLET_CHAR}  `

export const khanalyticsRecordingStart = 1629266402000

export const RandomLoadingMessage = ['Computing...', 'Thinking...', 'Cooking some food', 'Give me a moment', 'Loading...']

export const enum RunEnvironments {
  PJS = 'pjs',
  Webpage = 'webpage',
  SQL = 'sql',
}

export const RunEnvironmentTitles: Record<RunEnvironments, string> = {
  [RunEnvironments.PJS]: 'Processing.js',
  [RunEnvironments.Webpage]: 'Webpage',
  [RunEnvironments.SQL]: 'SQL',
}
export const RunEnvironmentOptionKeys: Record<RunEnvironments, string[]> = {
  [RunEnvironments.PJS]: ['width', 'height', 'delay', 'canvas', 'loopProtector'],
  [RunEnvironments.Webpage]: ['width', 'height', 'boilerplate'],
  [RunEnvironments.SQL]: ['width', 'height'],
}

export const AcceptedRunEnvironments = [RunEnvironments.PJS, RunEnvironments.Webpage, RunEnvironments.SQL]
