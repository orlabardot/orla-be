import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma'
import { UnauthorizedError } from '../../errors/app-errors'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    // request.jwtVerify() resolve com o payload assinado ({sub, tenantId,
    // role} — não {id, ...}). request.user só ganha o formato {id,...} na
    // reatribuição no fim desta função; usar request.user.id aqui (antes
    // dela) é sempre undefined, faz o findFirst abaixo cair sem filtro de
    // id e resolver pro primeiro usuário ativo do banco, não pro dono do
    // token. Usa o payload retornado diretamente pra não depender do tipo
    // de request.user, que muda de forma ao longo da função.
    const payload = await request.jwtVerify<{ sub: string }>()

    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        role: true,
        name: true,
        email: true,
      },
    })

    if (!user) {
      throw new UnauthorizedError('User not found or inactive')
    }

    request.user = user
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return reply.status(401).send({ code: err.code, message: err.message })
    }
    return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' })
  }
}
