export class ValidationError extends Error {
  constructor(...args: (string | undefined)[]) {
    super(...args)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError)
    }

    this.name = 'ValidationError'
  }
}
