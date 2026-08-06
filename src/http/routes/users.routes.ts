import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { createUserUseCase } from '../../modules/users/use-cases/create-user.use-case'
import { listUsersUseCase } from '../../modules/users/use-cases/list-users.use-case'
import { updateUserUseCase } from '../../modules/users/use-cases/update-user.use-case'

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.email(),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'employee']).default('employee'),
})

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.email().optional(),
  role: z.enum(['admin', 'employee']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
})

const idParamSchema = z.object({
  id: z.string().uuid(),
})

export async function usersRoutes(app: FastifyInstance) {
  // Gestão de usuários é restrita a admins — nenhum employee acessa essas rotas
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)
  app.addHook('preHandler', requireAdmin)

  // GET /users
  app.get('/users', async (request, reply) => {
    const users = await listUsersUseCase({ tenantId: request.tenant.id })
    return reply.send({ data: users })
  })

  // POST /users
  app.post('/users', async (request, reply) => {
    const body = createUserSchema.parse(request.body)
    const user = await createUserUseCase({
      tenantId: request.tenant.id,
      ...body,
    })
    return reply.status(201).send({ data: user })
  })

  // PUT /users/:id
  app.put('/users/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const body = updateUserSchema.parse(request.body)
    const user = await updateUserUseCase({
      tenantId: request.tenant.id,
      id,
      actingUserId: request.user.id,
      ...body,
    })
    return reply.send({ data: user })
  })
}
