import { FastifyInstance } from 'fastify'
import { makeTenant } from './tenant.factory'
import { makeUser } from './user.factory'

export async function setupTenantWithAdmin(app: FastifyInstance) {
  const tenant = await makeTenant()

  // Sem email fixo: email é único globalmente (não só por tenant), então um
  // valor fixo colide sempre que um teste cria mais de um admin (ex.: os
  // testes de isolamento entre tenants, que chamam isso duas vezes).
  const { user, password } = await makeUser({
    tenantId: tenant.id,
    name: 'Admin Test',
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
