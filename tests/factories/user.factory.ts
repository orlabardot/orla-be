import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../../src/lib/prisma'

interface MakeUserOptions {
  tenantId: string
  name?: string
  email?: string
  password?: string
  role?: string
}

export async function makeUser(options: MakeUserOptions) {
  const password = options.password ?? '123456'
  const passwordHash = await bcrypt.hash(password, 8)

  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      tenantId: options.tenantId,
      name: options.name ?? 'Test User',
      email: options.email ?? `user-${randomUUID().slice(0, 8)}@test.com`,
      passwordHash,
      role: options.role ?? 'employee',
    },
  })

  return { user, password }
}
