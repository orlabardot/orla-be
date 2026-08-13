import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { setupTenantWithAdmin } from '../factories/setup'
import { resetDatabase } from '../helpers/reset-db'

describe('Products E2E', () => {
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

  it('POST /products — cria produto com dados válidos', async () => {
    const ctx = await setupTenantWithAdmin(app)

    const response = await app.inject({
      method: 'POST',
      url: '/products',
      headers: headers(ctx),
      payload: { sku: 'OB-1234', name: 'Oakley Holbrook' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().data).toMatchObject({
      sku: 'OB-1234',
      name: 'Oakley Holbrook',
    })
  })

  it('POST /products — rejeita SKU duplicado', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    await app.inject({ method: 'POST', url: '/products', headers: h, payload: { sku: 'DUP-01', name: 'First' } })
    const dup = await app.inject({ method: 'POST', url: '/products', headers: h, payload: { sku: 'DUP-01', name: 'Second' } })

    expect(dup.statusCode).toBe(409)
  })

  it('GET /products — lista com paginação', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    for (let i = 1; i <= 3; i++) {
      await app.inject({ method: 'POST', url: '/products', headers: h, payload: { sku: `P-${i}`, name: `Product ${i}` } })
    }

    const page1 = await app.inject({ method: 'GET', url: '/products?page=1&limit=2', headers: h })
    expect(page1.statusCode).toBe(200)
    expect(page1.json().data).toHaveLength(2)
    expect(page1.json().meta.total).toBe(3)

    const page2 = await app.inject({ method: 'GET', url: '/products?page=2&limit=2', headers: h })
    expect(page2.json().data).toHaveLength(1)
  })

  it('GET /products/:id — retorna produto com variantes', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    const created = await app.inject({ method: 'POST', url: '/products', headers: h, payload: { sku: 'V-01', name: 'Teste' } })
    const productId = created.json().data.id

    await app.inject({
      method: 'POST',
      url: `/products/${productId}/variants`,
      headers: h,
      payload: { skuVariant: 'V-01 C1', colorCode: 'C1', colorLabel: 'Preto' },
    })

    const response = await app.inject({ method: 'GET', url: `/products/${productId}`, headers: h })

    expect(response.statusCode).toBe(200)
    expect(response.json().data.variants).toHaveLength(1)
    expect(response.json().data.variants[0].colorLabel).toBe('Preto')
  })

  it('PUT /products/:id — permite alterar o SKU', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    const created = await app.inject({ method: 'POST', url: '/products', headers: h, payload: { sku: 'OLD-01', name: 'Produto' } })
    const productId = created.json().data.id

    const updated = await app.inject({
      method: 'PUT',
      url: `/products/${productId}`,
      headers: h,
      payload: { sku: 'NEW-01' },
    })

    expect(updated.statusCode).toBe(200)
    expect(updated.json().data.sku).toBe('NEW-01')
  })

  it('PUT /products/:id — rejeita SKU duplicado de outro produto', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    await app.inject({ method: 'POST', url: '/products', headers: h, payload: { sku: 'TAKEN-01', name: 'Primeiro' } })
    const created = await app.inject({ method: 'POST', url: '/products', headers: h, payload: { sku: 'FREE-01', name: 'Segundo' } })
    const productId = created.json().data.id

    const updated = await app.inject({
      method: 'PUT',
      url: `/products/${productId}`,
      headers: h,
      payload: { sku: 'TAKEN-01' },
    })

    expect(updated.statusCode).toBe(409)
  })

  it('DELETE /products/:id — soft delete', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    const created = await app.inject({ method: 'POST', url: '/products', headers: h, payload: { sku: 'DEL-01', name: 'To Delete' } })
    const productId = created.json().data.id

    const del = await app.inject({ method: 'DELETE', url: `/products/${productId}`, headers: h })
    expect(del.statusCode).toBe(204)

    // Não aparece mais na listagem
    const list = await app.inject({ method: 'GET', url: '/products', headers: h })
    expect(list.json().data).toHaveLength(0)
  })

  it('DELETE /products/:id — Content-Type: application/json sem corpo dá 400, não 500', async () => {
    // Regressão: um cliente HTTP genérico (não o axios do frontend, que só
    // manda Content-Type quando tem payload) pode mandar esse header em toda
    // requisição por padrão, mesmo sem corpo. O content-type-parser do
    // Fastify rejeita isso (FST_ERR_CTP_EMPTY_JSON_BODY, statusCode 400),
    // mas o error handler não reconhecia esse erro nativo e caía no 500
    // genérico — reportando "erro no servidor" pra um problema que era só
    // da requisição do cliente.
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    const created = await app.inject({
      method: 'POST',
      url: '/products',
      headers: h,
      payload: { sku: 'DEL-02', name: 'To Delete Via Generic Client' },
    })
    const productId = created.json().data.id

    const del = await app.inject({
      method: 'DELETE',
      url: `/products/${productId}`,
      headers: { ...h, 'content-type': 'application/json' },
    })

    expect(del.statusCode).toBe(400)
    expect(del.json().code).toBe('FST_ERR_CTP_EMPTY_JSON_BODY')
  })

  it('isolamento de tenant — tenant A não vê produtos do tenant B', async () => {
    const ctxA = await setupTenantWithAdmin(app)
    const ctxB = await setupTenantWithAdmin(app)

    await app.inject({
      method: 'POST',
      url: '/products',
      headers: headers(ctxA),
      payload: { sku: 'A-01', name: 'Only A' },
    })

    const response = await app.inject({ method: 'GET', url: '/products', headers: headers(ctxB) })
    expect(response.json().data).toHaveLength(0)
  })
})
