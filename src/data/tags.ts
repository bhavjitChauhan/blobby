import { codeBlock } from '@sapphire/utilities'
import { inlineCode } from '@discordjs/builders'
import { hyperlinkSilent } from '../lib/utils/discord'

export default [
  {
    name: 'Loop Protector',
    keywords: ['loop protector', 'lp', 'timeout', 'infinite', 'loop'],
    content: `Khan Academy "injects" a loop protector into your code that will stop the program if loop takes too long to run. This is to prevent infinite loops from running forever and crashing the browser.

Sometimes this can get in the way, so if you know what you're doing you can disable it like this:
${codeBlock(
  'js',
  `
var window = (function() { return this; })();
window.LoopProtector.prototype.leave = null;
`
)}`,
  },
  {
    name: 'JSHint',
    keywords: ['jshint', 'error', 'es6', 'let', 'const'],
    content: `${hyperlinkSilent(
      'JSHint',
      'https://jshint.com/'
    )} is a tool to detect errors before they happen. Khan Academy uses it to do that as well as to enforce some ${hyperlinkSilent(
      'coding style rules',
      'https://github.com/Khan/live-editor/blob/fb69175850f3e27b4bc9303b37c4f889a7b50c74/js/shared/config.js#L372'
    )} (i.e. semicolons, braces).

You can disable it by adding a ${inlineCode(
      '//jshint ignore: start'
    )} comment at the top of your program. This will also give you direct access to some ${hyperlinkSilent(
      'global objects',
      'https://bhavjitchauhan.github.io/Essentials/tutorial-Functionality.html#jshint:~:text=%3D%201%3B-,Global%20Objects,-JavaScript%20includes%20standard'
    )}.`,
  },
  {
    name: 'BabyHint',
    keywords: ['babyhint', 'error'],
    content: `${hyperlinkSilent(
      'BabyHint',
      'https://github.com/Khan/live-editor/blob/master/js/output/pjs/babyhint.js'
    )} is project made by ${hyperlinkSilent(
      'Pamela Fox',
      'https://www.khanacademy.org/profile/pamela'
    )} to give more friendly error messages. It does all sorts of things like giving ${hyperlinkSilent(
      'code suggestions',
      'https://github.com/Khan/live-editor/blob/fb69175850f3e27b4bc9303b37c4f889a7b50c74/js/output/pjs/babyhint.js#L121'
    )}, enforcing ${hyperlinkSilent(
      'function parameter counts',
      'https://github.com/Khan/live-editor/blob/fb69175850f3e27b4bc9303b37c4f889a7b50c74/js/output/pjs/babyhint.js#L73'
    )} and banning ${hyperlinkSilent(
      'certain properties',
      'https://github.com/Khan/live-editor/blob/fb69175850f3e27b4bc9303b37c4f889a7b50c74/js/output/pjs/babyhint.js#L138'
    )}.

It works entirely using ${hyperlinkSilent(
      'regular expressions',
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions'
    )} so it's not perfect. If you want to disable it, you can add a hacky ${inlineCode(
      'void(/\\/*/);'
    )} line after all multiline comments in your program.`,
  },
] as Tag[]

export interface Tag {
  name: string
  keywords: string[]
  content: string
}
