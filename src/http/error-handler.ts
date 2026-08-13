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

  // @fastify/rate-limit lança um Error simples com `.statusCode` (429),
  // não uma AppError — sem isso, cai no 500 genérico abaixo e o cliente
  // nunca fica sabendo que foi bloqueado por rate limit.
  if ('statusCode' in error && error.statusCode === 429) {
    return reply.status(429).send({
      code: 'TOO_MANY_REQUESTS',
      message: error.message,
    })
  }

  // Outros erros nativos do Fastify que já vêm com um statusCode 4xx
  // próprio (ex.: o content-type-parser recusando corpo vazio com
  // Content-Type: application/json, código FST_ERR_CTP_EMPTY_JSON_BODY) —
  // sem isso, caíam no 500 genérico abaixo, relatando "erro no servidor"
  // quando o problema real é a própria requisição do cliente. A mensagem
  // desses erros nativos é sempre sobre o formato da requisição, nunca
  // vaza estado interno.
  if (
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return reply.status(error.statusCode).send({
      code: 'code' in error && error.code ? String(error.code) : 'BAD_REQUEST',
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
