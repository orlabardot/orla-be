import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { imagesRepository } from '../../modules/images/images.repository'
import { thumbKeyFor } from '../../modules/images/image-url'
import { storage } from '../../lib/storage'

const paramsSchema = z.object({
  imageId: z.string().uuid(),
})

const querySchema = z.object({
  v: z.enum(['original', 'thumb']).default('original'),
})

const SIGNED_URL_TTL = 3600 // 1h
const REDIRECT_CACHE = 300 // 5min — bem abaixo do TTL da assinatura de destino

/**
 * Rota **pública** de leitura de imagem, sem JWT — uma tag `<img>` não manda header de
 * autorização, e o Puppeteer que gera o PDF também não. Redireciona pra uma URL assinada
 * do bucket, então os bytes não passam por aqui, só o 302.
 *
 * Só é exercitada quando o bucket não tem domínio público de leitura configurado
 * (`R2_PUBLIC_URL`). Com o domínio configurado, as URLs já apontam direto pro CDN e esta
 * rota deixa de ser usada.
 */
export async function publicImagesRoutes(app: FastifyInstance) {
  app.get('/img/:imageId', {
    // O rate limit global (100/min/IP) é dimensionado pra chamadas de API, não pra
    // carregamento de imagem: uma única página de catálogo dispara dezenas de GETs aqui
    // e estouraria a cota, voltando a quebrar as fotos. Este handler só faz um SELECT
    // por PK e um 302, então tem cota própria e folgada.
    config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { imageId } = paramsSchema.parse(request.params)
    const { v } = querySchema.parse(request.query)

    const image = await imagesRepository.findById(imageId)
    if (!image) {
      return reply.status(404).send({ code: 'RESOURCE_NOT_FOUND', message: 'Image not found' })
    }

    const key = v === 'thumb' ? thumbKeyFor(image.storageKey) : image.storageKey
    const signedUrl = await storage.getSignedUrl(key, SIGNED_URL_TTL)

    return reply
      .header('Cache-Control', `public, max-age=${REDIRECT_CACHE}`)
      .redirect(signedUrl, 302)
  })
}
