import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { generatePdfUseCase } from '../../modules/pdf/use-cases/generate-pdf.use-case'

const generatePdfSchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1).max(100),
  clientName: z.string().max(255).optional(),
})

export async function pdfRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)

  // POST /pdf/generate
  app.post('/pdf/generate', async (request, reply) => {
    const body = generatePdfSchema.parse(request.body)

    const pdfBuffer = await generatePdfUseCase({
      tenantId: request.tenant.id,
      tenantName: request.tenant.name,
      variantIds: body.variantIds,
      clientName: body.clientName,
    })

    const date = new Date().toISOString().split('T')[0]

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="catalogo-${date}.pdf"`)
      .send(pdfBuffer)
  })
}
