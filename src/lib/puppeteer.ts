import { ElementHandle, launch, TimeoutError } from 'puppeteer'
import { client } from '../index'
import type { AceAjaxEditorElement } from '../types'
import { Stopwatch } from '@sapphire/stopwatch'
import type { RunEnvironments } from './constants'

export async function evaluate(
  type: RunEnvironments,
  code: string,
  width: number,
  height: number,
  setup: ((frame: ElementHandle, data: Record<string, unknown>) => Promise<void>) | null,
  teardown: ((frame: ElementHandle, data: Record<string, unknown>) => Promise<void>) | null
) {
  const data: Record<string, unknown> = {}
  let success, error

  const stopwatch = new Stopwatch()
  const browser = await launch()

  try {
    const page = await browser.newPage()
    // Editor is still present in DOM, but hidden
    await page.goto(`https://www.khanacademy.org/computer-programming/new/${type}?editor=no&width=${width}&height=${height}`)

    // Wait for editor element and output frame
    await page.waitForSelector('.ace_editor')
    await page.waitForSelector('#output-frame')

    // Get editor element
    const editorHandle = await page.$('.ace_editor')
    if (!editorHandle) throw new Error('Could not find editor')

    // Get output frame
    const frameHandle = await page.$('#output-frame')
    if (!frameHandle) throw new Error('Could not find output frame')
    const frame = await frameHandle.contentFrame()
    if (!frame) throw new Error('Could not resolve output frame')

    // Add event listener for code execution
    await page.evaluate(() => {
      window.addEventListener('message', ({ data }) => {
        const { results } = JSON.parse(data)
        // Ensure the message is for the current code
        if (results?.code && results.code.trim().length !== 0) {
          window._runDone = true
          window._errors = results.errors
        }
      })
    })

    // Run any pre-execution code
    if (setup) await setup(frameHandle, data)

    // Set editor value to code
    await editorHandle.evaluate((handle, code) => {
      ;(handle as AceAjaxEditorElement).env.editor.setValue(code)
    }, code)
    await editorHandle.dispose()

    // Wait for code execution
    await page.waitForFunction(() => window._runDone)
    const errors = await page.evaluate(() => window._errors)
    if (Array.isArray(errors) && errors.length > 0) {
      if (errors[0].infiniteLoopNodeType) error = 'Infinite loop detected'
      else error = errors[0].text
    }

    // Run any post-execution code
    if (teardown) await teardown(frameHandle, data)

    success = !error
  } catch (err) {
    if (err && err instanceof TimeoutError) {
      error = 'Your code took too long to execute.'
    } else if (err && err instanceof Error && err.stack) {
      client.logger.error(err)
    } else {
      client.logger.error('Unknown error', err)
    }
    success = false
  } finally {
    await browser.close()
  }
  stopwatch.stop()

  return { success, error, stopwatch, data }
}
