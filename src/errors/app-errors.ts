export abstract class AppError extends Error {
  abstract readonly statusCode: number
  abstract readonly code: string

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ResourceNotFoundError extends AppError {
  readonly statusCode = 404
  readonly code = 'RESOURCE_NOT_FOUND'

  constructor(resource: string, id?: string) {
    super(id ? `${resource} with id "${id}" not found` : `${resource} not found`)
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401
  readonly code = 'UNAUTHORIZED'

  constructor(message = 'Authentication required') {
    super(message)
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403
  readonly code = 'FORBIDDEN'

  constructor(message = 'Insufficient permissions') {
    super(message)
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409
  readonly code = 'CONFLICT'

  constructor(message: string) {
    super(message)
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 422
  readonly code = 'VALIDATION_ERROR'

  constructor(message: string) {
    super(message)
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400
  readonly code = 'BAD_REQUEST'

  constructor(message: string) {
    super(message)
  }
}
