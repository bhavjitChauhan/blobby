export {}

export interface LiveEditorError {
  type?: 'error'
  column?: number
  line?: number
  priority?: number
  source?: string
  text?: string
  lint?: Record<string, unknown>
  infiniteLoopNodeType?: string
}

declare global {
  interface Window {
    _runDone: boolean | undefined
    _errors: Array<LiveEditorError> | undefined
    LoopProtector: {
      prototype: {
        leave: null
      }
    }
  }
}

export interface AceAjaxEditorElement extends Element {
  env: {
    editor: AceAjax.Editor
  }
}
