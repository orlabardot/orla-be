import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { listCatalogUseCase } from '../../modules/variants/use-cases/list-catalog.use-case'

const listCatalogSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  q: z.string().optional(),
  frameType: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  colorCode: z.string().optional(),
  bridgeMin: z.coerce.number().optional(),
  bridgeMax: z.coerce.number().optional(),
  templeMin: z.coerce.number().optional(),
  templeMax: z.coerce.number().optional(),
  tagIds: z.string().optional(), // CSV: "uuid1,uuid2"
})

export async function catalogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)

  // GET /catalog — lista plana de variantes para o catálogo
  app.get('/catalog', async (request, reply) => {
    const query = listCatalogSchema.parse(request.query)
    const tagIds = query.tagIds?.split(',').filter(Boolean)

    const result = await listCatalogUseCase({
      tenantId: request.tenant.id,
      page: query.page,
      limit: query.limit,
      q: query.q,
      frameType: query.frameType,
      categoryId: query.categoryId,
      brandId: query.brandId,
      colorCode: query.colorCode,
      bridgeMin: query.bridgeMin,
      bridgeMax: query.bridgeMax,
      templeMin: query.templeMin,
      templeMax: query.templeMax,
      tagIds,
    })

    return reply.send(result)
  })
}
