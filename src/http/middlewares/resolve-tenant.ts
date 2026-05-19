import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma'

export async function resolveTenant(request: FastifyRequest, reply: FastifyReply) {
  // Resolve tenant via header (x-tenant-slug) ou subdomínio
  let slug: string | undefined

  const tenantHeader = request.headers['x-tenant-slug']
  if (typeof tenantHeader === 'string') {
    slug = tenantHeader
  } else {
    // Extrair subdomínio: acme.seuapp.com → 'acme'
    const host = request.hostname
    const parts = host.split('.')
    if (parts.length >= 3) {
      slug = parts[0]
    }
  }

  if (!slug) {
    return reply.status(400).send({
      code: 'BAD_REQUEST',
      message: 'Tenant not identified. Provide x-tenant-slug header or use subdomain.',
    })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  })

  if (!tenant) {
    return reply.status(404).send({
      code: 'TENANT_NOT_FOUND',
      message: `Tenant "${slug}" not found`,
    })
  }

  request.tenant = tenant
}
