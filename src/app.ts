import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyCompress from '@fastify/compress'
import fastifyMultipart from '@fastify/multipart'
import { env } from './config/env'
import { errorHandler } from './http/error-handler'
import { authRoutes } from './http/routes/auth.routes'
import { categoriesRoutes } from './http/routes/categories.routes'
import { brandsRoutes } from './http/routes/brands.routes'
import { tagsRoutes } from './http/routes/tags.routes'
import { productsRoutes } from './http/routes/products.routes'
import { variantsRoutes } from './http/routes/variants.routes'
import { imagesRoutes } from './http/routes/images.routes'
import { publicImagesRoutes } from './http/routes/public-images.routes'
import { pdfRoutes } from './http/routes/pdf.routes'
import { catalogRoutes } from './http/routes/catalog.routes'
import { usersRoutes } from './http/routes/users.routes'
import { ordersRoutes } from './http/routes/orders.routes'
import { tenantRoutes } from './http/routes/tenant.routes'
import { prisma } from './lib/prisma'

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            host: request.headers.host,
            remoteAddress: request.ip,
          }
        },
      },
    },
  })

  // 6.8 CORS restritivo (deve ser registrado antes do Helmet)
  app.register(fastifyCors, {
    origin: env.NODE_ENV === 'production' ? env.CORS_ORIGIN : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  // 6.1 Helmet com CSP
  app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: [
          "'self'",
          'data:',
          `https://${env.AWS_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com`,
          // Domínio público do R2, quando configurado — sem isso o CSP bloquearia as
          // próprias imagens do catálogo em qualquer página servida por esta API.
          ...(env.R2_PUBLIC_URL ? [env.R2_PUBLIC_URL] : []),
        ],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  app.register(fastifyCompress)

  // 6.2 Rate limit global
  app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  })

  // JWT
  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  })

  // 6.4 Request-ID no header de resposta
  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('X-Request-Id', _request.id)
    done()
  })

  // Error handler global
  app.setErrorHandler(errorHandler)

  // 6.5 Health check com verificação de DB
  app.get('/health', async () => {
    let dbStatus = 'ok'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'error'
    }
    return { status: dbStatus === 'ok' ? 'ok' : 'degraded', db: dbStatus, timestamp: new Date().toISOString() }
  })

  // Rotas
  app.register(authRoutes)
  app.register(categoriesRoutes)
  app.register(brandsRoutes)
  app.register(tagsRoutes)
  app.register(productsRoutes)
  app.register(variantsRoutes)
  app.register(imagesRoutes)
  app.register(publicImagesRoutes)
  app.register(pdfRoutes)
  app.register(catalogRoutes)
  app.register(usersRoutes)
  app.register(ordersRoutes)
  app.register(tenantRoutes)

  return app
}
