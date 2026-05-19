import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string     // user id
      tenantId: string
      role: string
    }
    user: {
      id: string
      tenantId: string
      role: string
      name: string
      email: string
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant: {
      id: string
      slug: string
      name: string
    }
  }
}
