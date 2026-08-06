import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { brandsRepository } from '../../modules/catalog/catalog.repository'
import { createBrandUseCase } from '../../modules/catalog/use-cases/create-brand.use-case'
import { updateBrandUseCase } from '../../modules/catalog/use-cases/update-brand.use-case'
import { deleteBrandUseCase } from '../../modules/catalog/use-cases/delete-brand.use-case'

const nameBodySchema = z.object({
  name: z.string().min(1).max(100),
})

const idParamSchema = z.object({
  id: z.string().uuid(),
})

export async function brandsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)

  // GET /brands
  app.get('/brands', async (request, reply) => {
    const brands = await brandsRepository.findAll(request.tenant.id)
    return reply.send({ data: brands })
  })

  // POST /brands (admin)
  app.post('/brands', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = nameBodySchema.parse(request.body)
    const brand = await createBrandUseCase({
      tenantId: request.tenant.id,
      name: body.name,
    })
    return reply.status(201).send({ data: brand })
  })

  // PUT /brands/:id (admin)
  app.put('/brands/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const body = nameBodySchema.parse(request.body)
    const brand = await updateBrandUseCase({
      tenantId: request.tenant.id,
      id,
      name: body.name,
    })
    return reply.send({ data: brand })
  })

  // DELETE /brands/:id (admin)
  app.delete('/brands/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    await deleteBrandUseCase({
      tenantId: request.tenant.id,
      id,
    })
    return reply.status(204).send()
  })
}
