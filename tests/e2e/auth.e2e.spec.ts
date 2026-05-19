import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { makeTenant } from '../factories/tenant.factory'
import { makeUser } from '../factories/user.factory'
import { resetDatabase } from '../helpers/reset-db'

describe('Auth E2E', () => {
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

  it('POST /auth/login — deve retornar token com credenciais válidas', async () => {
    const tenant = await makeTenant()
    await makeUser({
      tenantId: tenant.id,
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin',
    })

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'x-tenant-slug': tenant.slug },
      payload: { email: 'admin@test.com', password: 'admin123' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.token).toBeDefined()
    expect(body.user.email).toBe('admin@test.com')
    expect(body.user.role).toBe('admin')
  })

  it('POST /auth/login — deve rejeitar senha incorreta', async () => {
    const tenant = await makeTenant()
    await makeUser({
      tenantId: tenant.id,
      email: 'user@test.com',
      password: 'correct',
    })

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'x-tenant-slug': tenant.slug },
      payload: { email: 'user@test.com', password: 'wrong' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().code).toBe('UNAUTHORIZED')
  })

  it('POST /auth/login — deve rejeitar email inexistente', async () => {
    const tenant = await makeTenant()

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'x-tenant-slug': tenant.slug },
      payload: { email: 'ghost@test.com', password: 'any' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('GET /auth/me — deve retornar dados do usuário autenticado', async () => {
    const tenant = await makeTenant()
    const { user } = await makeUser({
      tenantId: tenant.id,
      email: 'me@test.com',
      role: 'admin',
    })

    const token = app.jwt.sign({ sub: user.id, tenantId: tenant.id, role: user.role })

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        'x-tenant-slug': tenant.slug,
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().user.email).toBe('me@test.com')
  })

  it('GET /auth/me — deve rejeitar sem token', async () => {
    const tenant = await makeTenant()

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { 'x-tenant-slug': tenant.slug },
    })

    expect(response.statusCode).toBe(401)
  })

  it('deve isolar tenants — user do tenant A não loga no tenant B', async () => {
    const tenantA = await makeTenant({ slug: 'tenant-a' })
    const tenantB = await makeTenant({ slug: 'tenant-b' })

    await makeUser({
      tenantId: tenantA.id,
      email: 'admin@a.com',
      password: 'pass',
    })

    // Tentar logar com credenciais do tenant A no tenant B
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'x-tenant-slug': tenantB.slug },
      payload: { email: 'admin@a.com', password: 'pass' },
    })

    expect(response.statusCode).toBe(401)
  })
})
