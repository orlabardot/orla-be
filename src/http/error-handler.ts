import { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { AppError } from '../errors/app-errors'
import { ZodError } from 'zod'

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Erros de domínio tipados
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
    })
  }

  // Erros de validação Zod
  if (error instanceof ZodError) {
    return reply.status(422).send({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: error.flatten().fieldErrors,
    })
  }

  // Erros de validação do Fastify (JSON Schema)
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      code: 'BAD_REQUEST',
      message: error.message,
    })
  }

  // Erro genérico — não vazar detalhes em produção
  request.log.error(error)
  return reply.status(500).send({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  })
}
