import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveTenantFromAuth } from '../middlewares/resolve-tenant-from-auth'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/require-admin'
import { tenantRepository } from '../../modules/tenant/tenant.repository'

const updateSettingsSchema = z.object({
  whatsappPhone: z.string().min(1).max(32).nullable(),
})

export async function tenantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', resolveTenantFromAuth)
  app.addHook('preHandler', requireAdmin)

  // GET /tenant/settings
  app.get('/tenant/settings', async (request, reply) => {
    const settings = await tenantRepository.findSettings(request.tenant.id)
    return reply.send({ data: settings })
  })

  // PATCH /tenant/settings
  app.patch('/tenant/settings', async (request, reply) => {
    const body = updateSettingsSchema.parse(request.body)
    const settings = await tenantRepository.updateSettings(request.tenant.id, body)
    return reply.send({ data: settings })
  })
}
