import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { setupTenantWithAdmin } from '../factories/setup'
import { resetDatabase } from '../helpers/reset-db'
import { closeBrowser } from '../../src/lib/pdf'

describe('PDF E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await closeBrowser()
    await app.close()
    await prisma.$disconnect()
  })

  afterEach(async () => {
    await resetDatabase()
  })

  function headers(ctx: { tenant: { slug: string }; token: string }) {
    return { 'x-tenant-slug': ctx.tenant.slug, authorization: `Bearer ${ctx.token}` }
  }

  it('POST /pdf/generate — gera PDF com variantes válidas', async () => {
    const ctx = await setupTenantWithAdmin(app)
    const h = headers(ctx)

    // Criar produto + variante
    const product = await app.inject({
      method: 'POST', url: '/products', headers: h,
      payload: { sku: 'PDF-01', name: 'Product PDF Test' },
    })
    const productId = product.json().data.id

    const variant = await app.inject({
      method: 'POST', url: `/products/${productId}/variants`, headers: h,
      payload: { skuVariant: 'PDF-01 C1', colorCode: 'C1', colorLabel: 'Preto' },
    })
    const variantId = variant.json().data.id

    const response = await app.inject({
      method: 'POST',
      url: '/pdf/generate',
      headers: { ...h, 'content-type': 'application/json' },
      payload: { variantIds: [variantId], clientName: 'Ótica Teste' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('application/pdf')
    expect(response.headers['content-disposition']).toContain('catalogo-')

    // Verificar que o body é um PDF (começa com %PDF)
    const pdfHeader = response.rawPayload.subarray(0, 5).toString()
    expect(pdfHeader).toBe('%PDF-')
  }, 30000)

  it('POST /pdf/generate — rejeita variantes inexistentes', async () => {
    const ctx = await setupTenantWithAdmin(app)

    const response = await app.inject({
      method: 'POST',
      url: '/pdf/generate',
      headers: headers(ctx),
      payload: { variantIds: ['00000000-0000-0000-0000-000000000000'] },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().code).toBe('VALIDATION_ERROR')
  })

  it('POST /pdf/generate — rejeita body sem variantIds', async () => {
    const ctx = await setupTenantWithAdmin(app)

    const response = await app.inject({
      method: 'POST',
      url: '/pdf/generate',
      headers: headers(ctx),
      payload: {},
    })

    expect(response.statusCode).toBe(422)
  })
})
