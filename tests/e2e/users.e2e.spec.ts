import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { setupTenantWithAdmin, setupTenantWithEmployee } from '../factories/setup'
import { makeUser } from '../factories/user.factory'
import { resetDatabase } from '../helpers/reset-db'

describe('Users E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  afterEach(async () => {
    await resetDatabase()
  })

  function headers(ctx: { tenant: { slug: string }; token: string }) {
    return { 'x-tenant-slug': ctx.tenant.slug, authorization: `Bearer ${ctx.token}` }
  }

  it('DELETE /users/:id — soft delete: some da listagem e não consegue mais logar', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)
    const { user: employee, password } = await makeUser({
      tenantId: ctx.tenant.id,
      email: 'excluir-me@test.com',
      password: 'senha123',
      role: 'employee',
    })

    const del = await app.inject({ method: 'DELETE', url: `/users/${employee.id}`, headers: h })
    expect(del.statusCode).toBe(204)

    const list = await app.inject({ method: 'GET', url: '/users', headers: h })
    expect(list.json().data.map((u: { id: string }) => u.id)).not.toContain(employee.id)

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'excluir-me@test.com', password },
    })
    expect(login.statusCode).toBe(401)
  })

  it('DELETE /users/:id — admin não pode excluir a própria conta', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    const del = await app.inject({ method: 'DELETE', url: `/users/${ctx.user.id}`, headers: h })
    expect(del.statusCode).toBe(400)

    const list = await app.inject({ method: 'GET', url: '/users', headers: h })
    expect(list.json().data.map((u: { id: string }) => u.id)).toContain(ctx.user.id)
  })

  it('DELETE /users/:id — employee não pode excluir usuário (403)', async () => {
    const ctx = await setupTenantWithEmployee(app)
    const other = await makeUser({ tenantId: ctx.tenant.id, role: 'employee' })

    const del = await app.inject({
      method: 'DELETE',
      url: `/users/${other.user.id}`,
      headers: headers(ctx),
    })

    expect(del.statusCode).toBe(403)
  })

  it('DELETE /users/:id — 404 pra usuário inexistente', async () => {
    const ctx = await setupTenantWithAdmin(app)

    const del = await app.inject({
      method: 'DELETE',
      url: '/users/00000000-0000-0000-0000-000000000000',
      headers: headers(ctx),
    })

    expect(del.statusCode).toBe(404)
  })

  it('DELETE /users/:id — não vaza entre tenants (404, não 403)', async () => {
    const ctxA = await setupTenantWithAdmin(app)
    const ctxB = await setupTenantWithAdmin(app)
    const { user: userInB } = await makeUser({ tenantId: ctxB.tenant.id, role: 'employee' })

    const del = await app.inject({
      method: 'DELETE',
      url: `/users/${userInB.id}`,
      headers: headers(ctxA),
    })

    expect(del.statusCode).toBe(404)
  })
})
