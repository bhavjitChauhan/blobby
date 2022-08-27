import { join } from 'path'

export const rootDir = join(__dirname, '..', '..')
export const srcDir = join(rootDir, 'src')

export const RandomLoadingMessage = ['Computing...', 'Thinking...', 'Cooking some food', 'Give me a moment', 'Loading...']

export const RUN_ENVIRONMENTS: Record<string, string> = {
  pjs: 'Processing.js',
  html: 'HTML',
  sql: 'SQL',
}

export const RUN_PJS_OPTIONS_KEYS = ['width', 'height', 'delay', 'canvas', 'loopProtector']
export const RUN_HTML_OPTIONS_KEYS = ['width', 'height', 'boilerplate']
export const RUN_SQL_OPTIONS_KEYS = ['width', 'height']
