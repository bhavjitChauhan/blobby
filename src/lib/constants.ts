import { join } from 'path'
import { Program, ProgramType } from '@bhavjit/khan-api'

export const rootDir = join(__dirname, '..', '..')
export const srcDir = join(rootDir, 'src')

export const EN_SPACE_CHAR = '\u2002'
export const ZERO_WIDTH_SPACE_CHAR = '\u200B'
export const BULLET_CHAR = '\u2022'

export const BULLET_SEPARATOR = `  ${BULLET_CHAR}  `

export const KHANALYTICS_START = 1629266402000

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

export const AcceptedRunEnvironments = ['pjs', 'webpage', 'sql']

export const RunEnvironmentKhanApiMap: Record<ProgramType, RunEnvironments | null> = {
  [Program.Type.ProcessingJS]: RunEnvironments.PJS,
  [Program.Type.HTML]: RunEnvironments.Webpage,
  [Program.Type.SQL]: RunEnvironments.SQL,
  [Program.Type.Other]: null,
}

export const enum ErrorMessages {
  InappropriateUser = "I can't search for that user",
  InvalidProgram = "That doesn't look like a real program",
  UserNotFound = "I couldn't find that user",
  ProgramNotFound = "I couldn't find that program",
  FeedbackNotFound = "I couldn't find any feedback for that program",
}
