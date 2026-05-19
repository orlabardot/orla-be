import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma'
import { UnauthorizedError } from '../../errors/app-errors'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()

    const user = await prisma.user.findFirst({
      where: {
        id: request.user.id,
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
