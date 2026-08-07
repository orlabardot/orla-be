import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { createOrderUseCase } from '../../modules/orders/use-cases/create-order.use-case'
import { listOrdersUseCase } from '../../modules/orders/use-cases/list-orders.use-case'
import { updateOrderStatusUseCase } from '../../modules/orders/use-cases/update-order-status.use-case'

const createOrderSchema = z.object({
  cnpj: z.string().min(1).max(32),
  contactPhone: z.string().min(1).max(32),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .min(1)
    .max(100),
})

const updateStatusSchema = z.object({
  status: z.enum(['pendente', 'atendido']),
})

const idParamSchema = z.object({
  id: z.string().uuid(),
})

export async function ordersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)

  // POST /orders — qualquer usuário autenticado cria um pedido pra si mesmo
  app.post('/orders', async (request, reply) => {
    const body = createOrderSchema.parse(request.body)

    const order = await createOrderUseCase({
      tenantId: request.tenant.id,
      userId: request.user.id,
      cnpj: body.cnpj,
      contactPhone: body.contactPhone,
      items: body.items,
    })

    return reply.status(201).send({ data: order })
  })

  // GET /orders — admin vê todos os pedidos do tenant, cliente só os próprios
  app.get('/orders', async (request, reply) => {
    const orders = await listOrdersUseCase({
      tenantId: request.tenant.id,
      userId: request.user.id,
      role: request.user.role,
    })

    return reply.send({ data: orders })
  })

  // PATCH /orders/:id/status (admin)
  app.patch(
    '/orders/:id/status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params)
      const { status } = updateStatusSchema.parse(request.body)

      const order = await updateOrderStatusUseCase({
        tenantId: request.tenant.id,
        id,
        status,
      })

      return reply.send({ data: order })
    }
  )
}
