import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../../config/env'
import { authenticate } from '../middlewares/authenticate'
import { loginUseCase } from '../../modules/auth/use-cases/login.use-case'
import { changePasswordUseCase } from '../../modules/auth/use-cases/change-password.use-case'

const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login — rate limit: LOGIN_RATE_LIMIT_MAX tentativas/min por IP
  app.post('/auth/login', {
    config: { rateLimit: { max: env.LOGIN_RATE_LIMIT_MAX, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = loginBodySchema.parse(request.body)

    const { user, tenant } = await loginUseCase({
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
      tenant,
    })
  })

  // POST /auth/logout
  // JWT é stateless — o cliente descarta o token.
  // Rota existe para padronizar o fluxo no frontend.
  app.post(
    '/auth/logout',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.status(200).send({ message: 'Logged out successfully' })
    },
  )

  // GET /auth/me — retorna dados do usuário autenticado
  app.get(
    '/auth/me',
    { preHandler: [authenticate] },
    async (request, reply) => {
      return reply.status(200).send({ user: request.user })
    },
  )

  // PUT /auth/password — troca a própria senha. Diferente de PUT /users/:id
  // (admin-only), qualquer usuário autenticado — admin ou employee — pode
  // trocar a própria senha por aqui; exige a senha atual pra confirmar.
  app.put(
    '/auth/password',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const body = changePasswordBodySchema.parse(request.body)

      await changePasswordUseCase({
        tenantId: request.user.tenantId,
        userId: request.user.id,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      })

      return reply.status(200).send({ message: 'Password updated successfully' })
    },
  )
}
