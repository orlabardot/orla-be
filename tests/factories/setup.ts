import { FastifyInstance } from 'fastify'
import { makeTenant } from './tenant.factory'
import { makeUser } from './user.factory'

export async function setupTenantWithAdmin(app: FastifyInstance) {
  const tenant = await makeTenant()

  const { user, password } = await makeUser({
    tenantId: tenant.id,
    name: 'Admin Test',
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin',
  })

  const token = app.jwt.sign({
    sub: user.id,
    tenantId: tenant.id,
    role: user.role,
  })

  return { tenant, user, password, token }
}

export async function setupTenantWithEmployee(app: FastifyInstance) {
  const tenant = await makeTenant()

  const { user, password } = await makeUser({
    tenantId: tenant.id,
    name: 'Employee Test',
    role: 'employee',
  })

  const token = app.jwt.sign({
    sub: user.id,
    tenantId: tenant.id,
    role: user.role,
  })

  return { tenant, user, password, token }
}
