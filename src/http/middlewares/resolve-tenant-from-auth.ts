import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma'
import { UnauthorizedError } from '../../errors/app-errors'

// Roda depois de `authenticate`: resolve o tenant a partir do `tenantId` já
// validado dentro do JWT, em vez de confiar no header `x-tenant-slug` (que o
// cliente pode falsificar para tentar acessar dados de outro tenant).
export async function resolveTenantFromAuth(request: FastifyRequest, _reply: FastifyReply) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: request.user.tenantId },
    select: { id: true, slug: true, name: true },
  })

  if (!tenant) {
    throw new UnauthorizedError('Tenant not found')
  }

  request.tenant = tenant
}
