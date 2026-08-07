import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { setupTenantWithAdmin } from '../factories/setup'
import { resetDatabase } from '../helpers/reset-db'

describe('Variants E2E', () => {
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

  async function createProduct(app: FastifyInstance, h: Record<string, string>) {
    const created = await app.inject({
      method: 'POST',
      url: '/products',
      headers: h,
      payload: { sku: 'BULK-01', name: 'Produto' },
    })
    return created.json().data.id as string
  }

  it('POST /products/:id/variants/bulk — cria várias variantes de uma vez', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)
    const productId = await createProduct(app, h)

    const response = await app.inject({
      method: 'POST',
      url: `/products/${productId}/variants/bulk`,
      headers: h,
      payload: {
        variants: [
          { skuVariant: 'BULK-01 C1', colorCode: 'C1', colorLabel: 'Preto' },
          { skuVariant: 'BULK-01 C2', colorCode: 'C2', colorLabel: 'Azul' },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().data).toHaveLength(2)

    const list = await app.inject({ method: 'GET', url: `/products/${productId}/variants`, headers: h })
    expect(list.json().data).toHaveLength(2)
  })

  it('POST /products/:id/variants/bulk — rejeita SKU duplicado dentro do lote', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)
    const productId = await createProduct(app, h)

    const response = await app.inject({
      method: 'POST',
      url: `/products/${productId}/variants/bulk`,
      headers: h,
      payload: {
        variants: [
          { skuVariant: 'BULK-01 C1', colorCode: 'C1' },
          { skuVariant: 'BULK-01 C1', colorCode: 'C2' },
        ],
      },
    })

    expect(response.statusCode).toBe(422)

    const list = await app.inject({ method: 'GET', url: `/products/${productId}/variants`, headers: h })
    expect(list.json().data).toHaveLength(0)
  })

  it('POST /products/:id/variants/bulk — rejeita SKU que já existe no banco (nenhuma variante do lote é criada)', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)
    const productId = await createProduct(app, h)

    await app.inject({
      method: 'POST',
      url: `/products/${productId}/variants`,
      headers: h,
      payload: { skuVariant: 'BULK-01 C1', colorCode: 'C1' },
    })

    const response = await app.inject({
      method: 'POST',
      url: `/products/${productId}/variants/bulk`,
      headers: h,
      payload: {
        variants: [
          { skuVariant: 'BULK-01 C2', colorCode: 'C2' },
          { skuVariant: 'BULK-01 C1', colorCode: 'C3' },
        ],
      },
    })

    expect(response.statusCode).toBe(409)

    // Nada do lote deve ter sido criado (a variante C2, que seria válida, não deve existir)
    const list = await app.inject({ method: 'GET', url: `/products/${productId}/variants`, headers: h })
    expect(list.json().data).toHaveLength(1)
  })
})
