import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenant } from '../middlewares/resolve-tenant'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { categoriesRepository } from '../../modules/catalog/catalog.repository'
import { createCategoryUseCase } from '../../modules/catalog/use-cases/create-category.use-case'
import { updateCategoryUseCase } from '../../modules/catalog/use-cases/update-category.use-case'
import { deleteCategoryUseCase } from '../../modules/catalog/use-cases/delete-category.use-case'

const nameBodySchema = z.object({
  name: z.string().min(1).max(100),
})

const idParamSchema = z.object({
  id: z.string().uuid(),
})

export async function categoriesRoutes(app: FastifyInstance) {
  // Todas as rotas exigem tenant + auth
  app.addHook('preHandler', resolveTenant)
  app.addHook('preHandler', authenticate)

  // GET /categories
  app.get('/categories', async (request, reply) => {
    const categories = await categoriesRepository.findAll(request.tenant.id)
    return reply.send({ data: categories })
  })

  // POST /categories (admin)
  app.post('/categories', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = nameBodySchema.parse(request.body)
    const category = await createCategoryUseCase({
      tenantId: request.tenant.id,
      name: body.name,
    })
    return reply.status(201).send({ data: category })
  })

  // PUT /categories/:id (admin)
  app.put('/categories/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const body = nameBodySchema.parse(request.body)
    const category = await updateCategoryUseCase({
      tenantId: request.tenant.id,
      id,
      name: body.name,
    })
    return reply.send({ data: category })
  })

  // DELETE /categories/:id (admin)
  app.delete('/categories/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    await deleteCategoryUseCase({
      tenantId: request.tenant.id,
      id,
    })
    return reply.status(204).send()
  })
}
