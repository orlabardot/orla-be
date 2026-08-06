import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { tagsRepository } from '../../modules/catalog/catalog.repository'
import { createTagUseCase } from '../../modules/catalog/use-cases/create-tag.use-case'
import { updateTagUseCase } from '../../modules/catalog/use-cases/update-tag.use-case'
import { deleteTagUseCase } from '../../modules/catalog/use-cases/delete-tag.use-case'

const nameBodySchema = z.object({
  name: z.string().min(1).max(100),
})

const idParamSchema = z.object({
  id: z.string().uuid(),
})

export async function tagsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)

  // GET /tags
  app.get('/tags', async (request, reply) => {
    const tags = await tagsRepository.findAll(request.tenant.id)
    return reply.send({ data: tags })
  })

  // POST /tags (admin)
  app.post('/tags', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = nameBodySchema.parse(request.body)
    const tag = await createTagUseCase({
      tenantId: request.tenant.id,
      name: body.name,
    })
    return reply.status(201).send({ data: tag })
  })

  // PUT /tags/:id (admin)
  app.put('/tags/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const body = nameBodySchema.parse(request.body)
    const tag = await updateTagUseCase({
      tenantId: request.tenant.id,
      id,
      name: body.name,
    })
    return reply.send({ data: tag })
  })

  // DELETE /tags/:id (admin)
  app.delete('/tags/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    await deleteTagUseCase({
      tenantId: request.tenant.id,
      id,
    })
    return reply.status(204).send()
  })
}
