export class ApiError extends Error {
  constructor(message: string, readonly status = 400, readonly fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
  }
}
