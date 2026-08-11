import { storage } from '../../lib/storage'
import { publicApiUrl } from '../../config/env'

/**
 * A URL de uma imagem é sempre **derivada do `storageKey` na leitura**, nunca lida da
 * coluna `url` do banco. Isso é deliberado: a coluna congela o host que existia no dia
 * do upload, e foi exatamente isso que quebrou a produção (host da API S3 do R2 gravado
 * como se fosse público). Derivando na leitura, trocar de domínio não exige backfill e
 * os registros antigos se corrigem sozinhos.
 */

const ORIGINAL_SUFFIX = '-original.webp'
const THUMB_SUFFIX = '-thumb.webp'

export function thumbKeyFor(storageKey: string) {
  return storageKey.endsWith(ORIGINAL_SUFFIX)
    ? storageKey.replace(ORIGINAL_SUFFIX, THUMB_SUFFIX)
    : storageKey
}

interface ImageRow {
  id: string
  storageKey: string
}

/**
 * Quando o bucket tem leitura pública (`R2_PUBLIC_URL`, ou S3), aponta direto pro CDN.
 * Caso contrário, aponta pra `GET /img/:imageId` desta API, que redireciona pra uma URL
 * assinada — mantendo a URL final estável e utilizável em `<img>` e no PDF.
 */
export function imageUrlsFor(image: ImageRow) {
  const publicOriginal = storage.getPublicUrl(image.storageKey)

  if (publicOriginal) {
    return {
      url: publicOriginal,
      thumbUrl: storage.getPublicUrl(thumbKeyFor(image.storageKey)) ?? publicOriginal,
    }
  }

  return {
    url: `${publicApiUrl}/img/${image.id}`,
    thumbUrl: `${publicApiUrl}/img/${image.id}?v=thumb`,
  }
}

/** Reescreve `url` e acrescenta `thumbUrl` numa lista de imagens vinda do Prisma. */
export function withImageUrls<T extends ImageRow>(images: T[]) {
  return images.map((image) => ({ ...image, ...imageUrlsFor(image) }))
}

/** Reescreve as imagens de uma variante (shape usado nas rotas de produto/variante). */
export function withVariantImageUrls<T extends { images: ImageRow[] }>(variant: T) {
  return { ...variant, images: withImageUrls(variant.images) }
}

/** Idem, pra uma lista de variantes. */
export function withVariantsImageUrls<T extends { images: ImageRow[] }>(variants: T[]) {
  return variants.map(withVariantImageUrls)
}
