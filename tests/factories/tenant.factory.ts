import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'

export async function makeTenant(override: Partial<{ name: string; slug: string }> = {}) {
  const id = randomUUID()
  const slug = override.slug ?? `test-${id.slice(0, 8)}`

  return prisma.tenant.create({
    data: {
      id,
      name: override.name ?? `Test Tenant ${slug}`,
      slug,
    },
  })
}
