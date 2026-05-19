import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenant } from '../middlewares/resolve-tenant'
import { authenticate } from '../middlewares/authenticate'
import { loginUseCase } from '../../modules/auth/use-cases/login.use-case'

const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login — rate limit: 5 tentativas/min por IP
  app.post('/auth/login', {
    preHandler: [resolveTenant],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = loginBodySchema.parse(request.body)

    const { user } = await loginUseCase({
      tenantId: request.tenant.id,
      email: body.email,
      password: body.password,
    })

    const token = app.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    })

    return reply.status(200).send({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  })

  // POST /auth/logout
  // JWT é stateless — o cliente descarta o token.
  // Rota existe para padronizar o fluxo no frontend.
  app.post(
    '/auth/logout',
    { preHandler: [resolveTenant, authenticate] },
    async (_request, reply) => {
      return reply.status(200).send({ message: 'Logged out successfully' })
    },
  )

  // GET /auth/me — retorna dados do usuário autenticado
  app.get(
    '/auth/me',
    { preHandler: [resolveTenant, authenticate] },
    async (request, reply) => {
      return reply.status(200).send({ user: request.user })
    },
  )
}
