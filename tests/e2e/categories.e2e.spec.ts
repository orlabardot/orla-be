import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { setupTenantWithAdmin, setupTenantWithEmployee } from '../factories/setup'
import { resetDatabase } from '../helpers/reset-db'

describe('Categories E2E', () => {
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

  it('POST /categories — admin cria categoria', async () => {
    const { tenant, token } = await setupTenantWithAdmin(app)

    const response = await app.inject({
      method: 'POST',
      url: '/categories',
      headers: {
        'x-tenant-slug': tenant.slug,
        authorization: `Bearer ${token}`,
      },
      payload: { name: 'Armações' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().data).toMatchObject({
      name: 'Armações',
      slug: 'armacoes',
    })
  })

  it('POST /categories — employee não pode criar', async () => {
    const { tenant, token } = await setupTenantWithEmployee(app)

    const response = await app.inject({
      method: 'POST',
      url: '/categories',
      headers: {
        'x-tenant-slug': tenant.slug,
        authorization: `Bearer ${token}`,
      },
      payload: { name: 'Armações' },
    })

    expect(response.statusCode).toBe(403)
  })

  it('POST /categories — rejeita duplicata (mesmo slug)', async () => {
    const { tenant, token } = await setupTenantWithAdmin(app)
    const headers = { 'x-tenant-slug': tenant.slug, authorization: `Bearer ${token}` }

    await app.inject({ method: 'POST', url: '/categories', headers, payload: { name: 'Solar' } })
    const dup = await app.inject({ method: 'POST', url: '/categories', headers, payload: { name: 'Solar' } })

    expect(dup.statusCode).toBe(409)
  })

  it('GET /categories — lista categorias do tenant', async () => {
    const { tenant, token } = await setupTenantWithAdmin(app)
    const headers = { 'x-tenant-slug': tenant.slug, authorization: `Bearer ${token}` }

    await app.inject({ method: 'POST', url: '/categories', headers, payload: { name: 'Solar' } })
    await app.inject({ method: 'POST', url: '/categories', headers, payload: { name: 'Grau' } })

    const response = await app.inject({ method: 'GET', url: '/categories', headers })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toHaveLength(2)
  })

  it('PUT /categories/:id — atualiza categoria', async () => {
    const { tenant, token } = await setupTenantWithAdmin(app)
    const headers = { 'x-tenant-slug': tenant.slug, authorization: `Bearer ${token}` }

    const created = await app.inject({ method: 'POST', url: '/categories', headers, payload: { name: 'Solar' } })
    const id = created.json().data.id

    const updated = await app.inject({
      method: 'PUT',
      url: `/categories/${id}`,
      headers,
      payload: { name: 'Óculos de Sol' },
    })

    expect(updated.statusCode).toBe(200)
    expect(updated.json().data.name).toBe('Óculos de Sol')
    expect(updated.json().data.slug).toBe('oculos-de-sol')
  })

  it('DELETE /categories/:id — remove categoria', async () => {
    const { tenant, token } = await setupTenantWithAdmin(app)
    const headers = { 'x-tenant-slug': tenant.slug, authorization: `Bearer ${token}` }

    const created = await app.inject({ method: 'POST', url: '/categories', headers, payload: { name: 'Temp' } })
    const id = created.json().data.id

    const del = await app.inject({ method: 'DELETE', url: `/categories/${id}`, headers })
    expect(del.statusCode).toBe(204)

    const list = await app.inject({ method: 'GET', url: '/categories', headers })
    expect(list.json().data).toHaveLength(0)
  })

  it('isolamento de tenant — tenant A não vê categorias do tenant B', async () => {
    const ctxA = await setupTenantWithAdmin(app)
    const ctxB = await setupTenantWithAdmin(app)

    const headersA = { 'x-tenant-slug': ctxA.tenant.slug, authorization: `Bearer ${ctxA.token}` }
    const headersB = { 'x-tenant-slug': ctxB.tenant.slug, authorization: `Bearer ${ctxB.token}` }

    await app.inject({ method: 'POST', url: '/categories', headers: headersA, payload: { name: 'Apenas A' } })

    const response = await app.inject({ method: 'GET', url: '/categories', headers: headersB })
    expect(response.json().data).toHaveLength(0)
  })
})
