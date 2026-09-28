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

  it('login ignora x-tenant-slug e sempre resolve o tenant real do usuário', async () => {
    const tenantA = await makeTenant({ slug: 'tenant-a' })
    const tenantB = await makeTenant({ slug: 'tenant-b' })

    await makeUser({
      tenantId: tenantA.id,
      email: 'admin@a.com',
      password: 'pass',
    })

    // O login não usa mais x-tenant-slug pra resolver o tenant (ver
    // resolveTenantFromAuth): o header é falsificável, então mesmo mandando o
    // slug do tenant B o usuário só consegue logar no seu próprio tenant.
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'x-tenant-slug': tenantB.slug },
      payload: { email: 'admin@a.com', password: 'pass' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().tenant.id).toBe(tenantA.id)
  })

  it('PUT /auth/password — troca a senha com a senha atual correta', async () => {
    // Não passa por /auth/login aqui de propósito — o rate limit de login
    // (5/min) é por IP e compartilhado entre todos os testes deste arquivo
    // que usam o `app` do describe (ver o teste isolado de rate limit mais
    // abaixo). Confirma a troca chamando PUT /auth/password de novo com a
    // senha nova como "atual" — só bate se o hash foi realmente atualizado.
    const tenant = await makeTenant()
    const { user } = await makeUser({
      tenantId: tenant.id,
      email: 'trocar-senha@test.com',
      password: 'senha-antiga',
      role: 'employee',
    })
    const token = app.jwt.sign({ sub: user.id, tenantId: tenant.id, role: user.role })

    const response = await app.inject({
      method: 'PUT',
      url: '/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'senha-antiga', newPassword: 'senha-nova-123' },
    })
    expect(response.statusCode).toBe(200)

    const oldPasswordNoLongerWorks = await app.inject({
      method: 'PUT',
      url: '/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'senha-antiga', newPassword: 'outra-senha-123' },
    })
    expect(oldPasswordNoLongerWorks.statusCode).toBe(400)

    const newPasswordWorks = await app.inject({
      method: 'PUT',
      url: '/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'senha-nova-123', newPassword: 'outra-senha-123' },
    })
    expect(newPasswordWorks.statusCode).toBe(200)
  })

  it('PUT /auth/password — rejeita com senha atual incorreta e não altera a senha', async () => {
    const tenant = await makeTenant()
    const { user } = await makeUser({
      tenantId: tenant.id,
      email: 'senha-errada@test.com',
      password: 'senha-certa',
    })
    const token = app.jwt.sign({ sub: user.id, tenantId: tenant.id, role: user.role })

    const response = await app.inject({
      method: 'PUT',
      url: '/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'senha-chutada', newPassword: 'senha-nova-123' },
    })
    expect(response.statusCode).toBe(400)

    // senha original continua valendo — não foi alterada pela tentativa falha
    const stillWorksWithOriginal = await app.inject({
      method: 'PUT',
      url: '/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'senha-certa', newPassword: 'senha-nova-123' },
    })
    expect(stillWorksWithOriginal.statusCode).toBe(200)
  })

  it('PUT /auth/password — rejeita senha nova curta demais (422)', async () => {
    const tenant = await makeTenant()
    const { user } = await makeUser({ tenantId: tenant.id, password: 'senha-certa' })
    const token = app.jwt.sign({ sub: user.id, tenantId: tenant.id, role: user.role })

    const response = await app.inject({
      method: 'PUT',
      url: '/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'senha-certa', newPassword: 'curta' },
    })

    expect(response.statusCode).toBe(422)
  })

  it('PUT /auth/password — rejeita sem token', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/auth/password',
      payload: { currentPassword: 'a', newPassword: 'senha-nova-123' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('POST /auth/login — bloqueia com 429 (não 500) depois de estourar o rate limit', async () => {
    // Instância isolada só pra esse teste: o rate limit é por IP e fica
    // guardado em memória na instância do Fastify, então usar o `app`
    // compartilhado do describe poluiria (e seria poluído por) os outros
    // testes de login deste arquivo.
    const isolatedApp = buildApp()
    await isolatedApp.ready()

    const tenant = await makeTenant()
    await makeUser({ tenantId: tenant.id, email: 'ratelimit@test.com', password: 'pass' })

    const payload = { email: 'ratelimit@test.com', password: 'pass' }
    let lastResponse
    for (let i = 0; i < 6; i++) {
      lastResponse = await isolatedApp.inject({ method: 'POST', url: '/auth/login', payload })
    }

    // @fastify/rate-limit lança um Error simples com statusCode 429 — sem
    // tratamento explícito no error handler, isso caía num 500 genérico.
    expect(lastResponse!.statusCode).toBe(429)
    expect(lastResponse!.json().code).toBe('TOO_MANY_REQUESTS')

    await isolatedApp.close()
  })

  it('rate limit de login é por IP de verdade (trustProxy), não uma cota global compartilhada', async () => {
    // Regressão: sem trustProxy configurado, request.ip é sempre o IP
    // interno do proxy do Railway pra todo mundo — o rate limit vira uma
    // cota ÚNICA pra toda a plataforma (um atacante travaria o login de
    // todos os tenants). app.inject com um header x-forwarded-for simula
    // exatamente essa topologia (cliente -> proxy -> app).
    const isolatedApp = buildApp()
    await isolatedApp.ready()

    const tenant = await makeTenant()
    await makeUser({ tenantId: tenant.id, email: 'ip-a@test.com', password: 'pass' })
    await makeUser({ tenantId: tenant.id, email: 'ip-b@test.com', password: 'pass' })

    // Estoura o limite vindo do IP "A"
    let lastFromA
    for (let i = 0; i < 6; i++) {
      lastFromA = await isolatedApp.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'x-forwarded-for': '203.0.113.10' },
        payload: { email: 'ip-a@test.com', password: 'wrong' },
      })
    }
    expect(lastFromA!.statusCode).toBe(429)

    // IP "B" nunca tentou logar — se o rate limit fosse global (bug sem
    // trustProxy), essa tentativa também levaria 429. Com trustProxy
    // correto, tem sua própria cota e passa pela validação normal (401,
    // senha errada — não 429).
    const fromB = await isolatedApp.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'x-forwarded-for': '203.0.113.20' },
      payload: { email: 'ip-b@test.com', password: 'wrong' },
    })
    expect(fromB.statusCode).toBe(401)

    await isolatedApp.close()
  })
})
