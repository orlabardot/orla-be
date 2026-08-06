import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { uploadImageUseCase } from '../../modules/images/use-cases/upload-image.use-case'
import { deleteImageUseCase } from '../../modules/images/use-cases/delete-image.use-case'
import { setPrimaryImageUseCase } from '../../modules/images/use-cases/set-primary-image.use-case'

const variantIdParamSchema = z.object({
  variantId: z.string().uuid(),
})

const imageParamSchema = z.object({
  variantId: z.string().uuid(),
  imageId: z.string().uuid(),
})

export async function imagesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)

  // POST /variants/:variantId/images — upload (admin)
  app.post(
    '/variants/:variantId/images',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { variantId } = variantIdParamSchema.parse(request.params)

      const file = await request.file()
      if (!file) {
        return reply.status(400).send({ code: 'BAD_REQUEST', message: 'No file uploaded' })
      }

      const buffer = await file.toBuffer()

      const image = await uploadImageUseCase({
        tenantId: request.tenant.id,
        variantId,
        buffer,
        mimetype: file.mimetype,
        fileSize: buffer.length,
      })

      return reply.status(201).send({ data: image })
    },
  )

  // DELETE /variants/:variantId/images/:imageId (admin)
  app.delete(
    '/variants/:variantId/images/:imageId',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { variantId, imageId } = imageParamSchema.parse(request.params)

      await deleteImageUseCase({
        tenantId: request.tenant.id,
        variantId,
        imageId,
      })

      return reply.status(204).send()
    },
  )

  // PATCH /variants/:variantId/images/:imageId/primary (admin)
  app.patch(
    '/variants/:variantId/images/:imageId/primary',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { variantId, imageId } = imageParamSchema.parse(request.params)

      const image = await setPrimaryImageUseCase({
        tenantId: request.tenant.id,
        variantId,
        imageId,
      })

      return reply.send({ data: image })
    },
  )
}
