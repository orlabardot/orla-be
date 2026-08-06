import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { createProductUseCase } from '../../modules/products/use-cases/create-product.use-case'
import { listProductsUseCase } from '../../modules/products/use-cases/list-products.use-case'
import { getProductUseCase } from '../../modules/products/use-cases/get-product.use-case'
import { updateProductUseCase } from '../../modules/products/use-cases/update-product.use-case'
import { deleteProductUseCase } from '../../modules/products/use-cases/delete-product.use-case'

const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  frameType: z.enum(['grau', 'sol', 'clip-on', 'esportivo']).optional(),
  sizeMm: z.number().positive().optional(),
  bridgeSizeMm: z.number().positive().optional(),
  templeSizeMm: z.number().positive().optional(),
  gender: z.enum(['masculino', 'feminino', 'unissex', 'infantil']).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
})

const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  frameType: z.enum(['grau', 'sol', 'clip-on', 'esportivo']).optional(),
  sizeMm: z.number().positive().optional(),
  bridgeSizeMm: z.number().positive().optional(),
  templeSizeMm: z.number().positive().optional(),
  gender: z.enum(['masculino', 'feminino', 'unissex', 'infantil']).optional(),
  isActive: z.boolean().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
})

const listProductsSchema = z.object({
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

const idParamSchema = z.object({
  id: z.string().uuid(),
})

export async function productsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)

  // GET /products — listagem com filtros e paginação
  app.get('/products', async (request, reply) => {
    const query = listProductsSchema.parse(request.query)
    const tagIds = query.tagIds?.split(',').filter(Boolean)

    const result = await listProductsUseCase({
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

  // GET /products/:id — produto com variantes
  app.get('/products/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const product = await getProductUseCase({
      tenantId: request.tenant.id,
      id,
    })
    return reply.send({ data: product })
  })

  // POST /products (admin)
  app.post('/products', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = createProductSchema.parse(request.body)
    const product = await createProductUseCase({
      tenantId: request.tenant.id,
      createdBy: request.user.id,
      ...body,
    })
    return reply.status(201).send({ data: product })
  })

  // PUT /products/:id (admin)
  app.put('/products/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const body = updateProductSchema.parse(request.body)
    const product = await updateProductUseCase({
      tenantId: request.tenant.id,
      id,
      ...body,
    })
    return reply.send({ data: product })
  })

  // DELETE /products/:id — soft delete (admin)
  app.delete('/products/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    await deleteProductUseCase({
      tenantId: request.tenant.id,
      id,
    })
    return reply.status(204).send()
  })
}
