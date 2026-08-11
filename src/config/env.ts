import { z } from 'zod'

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3333),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('8h'),
    STORAGE_PROVIDER: z.enum(['s3', 'r2']).default('s3'),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string().default('us-east-1'),
    AWS_BUCKET_NAME: z.string(),
    R2_ENDPOINT: z.string().url().optional(), // obrigatório quando STORAGE_PROVIDER=r2
    // Domínio público de leitura do bucket (r2.dev ou domínio próprio). NÃO é o R2_ENDPOINT:
    // o R2_ENDPOINT é a API S3 e exige assinatura SigV4, então nunca serve pra <img>.
    // Sem essa variável as imagens são servidas via redirect em GET /img/:imageId.
    R2_PUBLIC_URL: z.string().url().transform(stripTrailingSlash).optional(),
    // Base absoluta desta API, usada pra montar as URLs de imagem do fallback.
    PUBLIC_API_URL: z.string().url().transform(stripTrailingSlash).optional(),
    RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
    CORS_ORIGIN: z.string().default('*'),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_PROVIDER === 'r2' && !value.R2_ENDPOINT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['R2_ENDPOINT'],
        message: 'R2_ENDPOINT é obrigatório quando STORAGE_PROVIDER=r2',
      })
    }
  })

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('❌ Invalid environment variables:')
  console.error(result.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = result.data

/**
 * Base absoluta desta API. No Railway o domínio público já vem no ambiente,
 * então o fallback de imagens funciona sem configuração extra.
 */
export const publicApiUrl =
  env.PUBLIC_API_URL ??
  (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${env.PORT}`)
