import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { variantsRepository } from '../../modules/variants/variants.repository'
import { createVariantUseCase } from '../../modules/variants/use-cases/create-variant.use-case'
import { updateVariantUseCase } from '../../modules/variants/use-cases/update-variant.use-case'
import { deleteVariantUseCase } from '../../modules/variants/use-cases/delete-variant.use-case'

const productIdParamSchema = z.object({
  id: z.string().uuid(),
})

const variantParamSchema = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
})

const createVariantSchema = z.object({
  skuVariant: z.string().min(1).max(150),
  colorCode: z.string().max(20).optional(),
  colorLabel: z.string().max(100).optional(),
})

const updateVariantSchema = z.object({
  colorLabel: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
})

export async function variantsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)

  // GET /products/:id/variants
  app.get('/products/:id/variants', async (request, reply) => {
    const { id } = productIdParamSchema.parse(request.params)
    const variants = await variantsRepository.findAllByProduct(id)
    return reply.send({ data: variants })
  })

  // POST /products/:id/variants (admin)
  app.post(
    '/products/:id/variants',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id: productId } = productIdParamSchema.parse(request.params)
      const body = createVariantSchema.parse(request.body)
      const variant = await createVariantUseCase({
        tenantId: request.tenant.id,
        productId,
        ...body,
      })
      return reply.status(201).send({ data: variant })
    },
  )

  // PUT /products/:id/variants/:variantId (admin)
  app.put(
    '/products/:id/variants/:variantId',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id: productId, variantId } = variantParamSchema.parse(request.params)
      const body = updateVariantSchema.parse(request.body)
      const variant = await updateVariantUseCase({
        tenantId: request.tenant.id,
        productId,
        variantId,
        ...body,
      })
      return reply.send({ data: variant })
    },
  )

  // DELETE /products/:id/variants/:variantId — soft delete (admin)
  app.delete(
    '/products/:id/variants/:variantId',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id: productId, variantId } = variantParamSchema.parse(request.params)
      await deleteVariantUseCase({
        tenantId: request.tenant.id,
        productId,
        variantId,
      })
      return reply.status(204).send()
    },
  )
}
