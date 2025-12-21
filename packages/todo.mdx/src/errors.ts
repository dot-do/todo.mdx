/**
 * Custom error types for todo.mdx packages
 * Provides structured error hierarchy with proper logging and context
 */

/**
 * Base error class for all todo.mdx errors
 * Provides consistent error handling with context and cause tracking
 */
export class TodoMdxError extends Error {
  public context?: Record<string, unknown>
  public readonly timestamp: Date

  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
    }
  ) {
    super(message, { cause: options?.cause })
    this.name = this.constructor.name
    this.context = options?.context
    this.timestamp = new Date()

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Get a formatted error message with context
   */
  public getFullMessage(): string {
    let msg = `[${this.name}] ${this.message}`

    if (this.context && Object.keys(this.context).length > 0) {
      msg += `\nContext: ${JSON.stringify(this.context, null, 2)}`
    }

    if (this.cause) {
      const causeMsg = this.cause instanceof Error ? this.cause.message : String(this.cause)
      msg += `\nCause: ${causeMsg}`
    }

    return msg
  }

  /**
   * Log error to console with full context
   */
  public log(): void {
    console.error(this.getFullMessage())
    if (this.stack) {
      console.error('Stack trace:', this.stack)
    }
  }
}

/**
 * Error thrown when MDX compilation fails
 */
export class CompilationError extends TodoMdxError {
  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      filePath?: string
    }
  ) {
    super(message, options)
    if (options?.filePath) {
      this.context = { ...this.context, filePath: options.filePath }
    }
  }
}

/**
 * Error thrown when parsing markdown/MDX files fails
 */
export class ParserError extends TodoMdxError {
  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      filePath?: string
      line?: number
      column?: number
    }
  ) {
    super(message, options)
    if (options?.filePath || options?.line || options?.column) {
      this.context = {
        ...this.context,
        ...(options.filePath && { filePath: options.filePath }),
        ...(options.line && { line: options.line }),
        ...(options.column && { column: options.column }),
      }
    }
  }
}

/**
 * Error thrown when data validation fails
 */
export class ValidationError extends TodoMdxError {
  public readonly field?: string

  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      field?: string
      value?: unknown
    }
  ) {
    super(message, options)
    this.field = options?.field
    if (options?.field || options?.value !== undefined) {
      this.context = {
        ...this.context,
        ...(options.field && { field: options.field }),
        ...(options.value !== undefined && { value: options.value }),
      }
    }
  }
}

/**
 * Error thrown when API requests fail
 */
export class ApiError extends TodoMdxError {
  public readonly statusCode?: number
  public readonly endpoint?: string

  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      statusCode?: number
      endpoint?: string
      responseBody?: unknown
    }
  ) {
    super(message, options)
    this.statusCode = options?.statusCode
    this.endpoint = options?.endpoint
    if (options?.statusCode || options?.endpoint || options?.responseBody !== undefined) {
      this.context = {
        ...this.context,
        ...(options.statusCode && { statusCode: options.statusCode }),
        ...(options.endpoint && { endpoint: options.endpoint }),
        ...(options.responseBody !== undefined && { responseBody: options.responseBody }),
      }
    }
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends TodoMdxError {
  public readonly configKey?: string

  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      configKey?: string
      expectedValue?: string
      actualValue?: unknown
    }
  ) {
    super(message, options)
    this.configKey = options?.configKey
    if (options?.configKey || options?.expectedValue || options?.actualValue !== undefined) {
      this.context = {
        ...this.context,
        ...(options.configKey && { configKey: options.configKey }),
        ...(options.expectedValue && { expectedValue: options.expectedValue }),
        ...(options.actualValue !== undefined && { actualValue: options.actualValue }),
      }
    }
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileSystemError extends TodoMdxError {
  public readonly filePath?: string
  public readonly operation?: 'read' | 'write' | 'delete' | 'watch' | 'stat'

  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      filePath?: string
      operation?: 'read' | 'write' | 'delete' | 'watch' | 'stat'
    }
  ) {
    super(message, options)
    this.filePath = options?.filePath
    this.operation = options?.operation
    if (options?.filePath || options?.operation) {
      this.context = {
        ...this.context,
        ...(options.filePath && { filePath: options.filePath }),
        ...(options.operation && { operation: options.operation }),
      }
    }
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends TodoMdxError {
  public readonly provider?: string

  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      provider?: string
    }
  ) {
    super(message, options)
    this.provider = options?.provider
    if (options?.provider) {
      this.context = { ...this.context, provider: options.provider }
    }
  }
}

/**
 * Error thrown when external process execution fails
 */
export class ProcessError extends TodoMdxError {
  public readonly command?: string
  public readonly exitCode?: number
  public readonly stdout?: string
  public readonly stderr?: string

  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      command?: string
      exitCode?: number
      stdout?: string
      stderr?: string
    }
  ) {
    super(message, options)
    this.command = options?.command
    this.exitCode = options?.exitCode
    this.stdout = options?.stdout
    this.stderr = options?.stderr
    if (options?.command || options?.exitCode || options?.stdout || options?.stderr) {
      this.context = {
        ...this.context,
        ...(options.command && { command: options.command }),
        ...(options.exitCode !== undefined && { exitCode: options.exitCode }),
        ...(options.stdout && { stdout: options.stdout }),
        ...(options.stderr && { stderr: options.stderr }),
      }
    }
  }
}

/**
 * Error thrown when GitHub operations fail
 */
export class GitHubError extends TodoMdxError {
  public readonly operation?: string

  constructor(
    message: string,
    options?: {
      cause?: Error | unknown
      context?: Record<string, unknown>
      operation?: string
      repo?: string
    }
  ) {
    super(message, options)
    this.operation = options?.operation
    if (options?.operation || options?.repo) {
      this.context = {
        ...this.context,
        ...(options.operation && { operation: options.operation }),
        ...(options.repo && { repo: options.repo }),
      }
    }
  }
}

/**
 * Helper function to safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return String(error)
}

/**
 * Helper function to create error context from Node.js error with code
 */
export function getNodeErrorContext(error: unknown): Record<string, unknown> {
  const context: Record<string, unknown> = {}

  if (error && typeof error === 'object') {
    if ('code' in error && typeof error.code === 'string') {
      context.code = error.code
    }
    if ('errno' in error) {
      context.errno = error.errno
    }
    if ('syscall' in error && typeof error.syscall === 'string') {
      context.syscall = error.syscall
    }
    if ('path' in error && typeof error.path === 'string') {
      context.path = error.path
    }
  }

  return context
}

/**
 * Type guard to check if error is a TodoMdxError
 */
export function isTodoMdxError(error: unknown): error is TodoMdxError {
  return error instanceof TodoMdxError
}

/**
 * Type guard to check if error is a specific TodoMdxError subclass
 */
export function isErrorType<T extends TodoMdxError>(
  error: unknown,
  ErrorClass: new (...args: any[]) => T
): error is T {
  return error instanceof ErrorClass
}
