import { afterEach, describe, expect, it, vi } from 'vitest'

const IMAGE = {
  id: '11111111-2222-3333-4444-555555555555',
  storageKey: 'tenants/t1/variants/v1/abc-original.webp',
}

const R2_API_ENDPOINT = 'https://8229053513ee375734bca027e267c68b.r2.cloudflarestorage.com'

/**
 * `env` e `publicApiUrl` são resolvidos no import, então cada cenário precisa recarregar
 * os módulos com o ambiente já ajustado.
 */
async function loadWithEnv(overrides: Record<string, string>) {
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value)
  }

  vi.resetModules()
  return import('./image-url')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('imageUrlsFor', () => {
  it('usa o domínio público do R2 quando configurado', async () => {
    const { imageUrlsFor } = await loadWithEnv({
      STORAGE_PROVIDER: 'r2',
      R2_ENDPOINT: R2_API_ENDPOINT,
      R2_PUBLIC_URL: 'https://imagens.exemplo.com',
    })

    expect(imageUrlsFor(IMAGE)).toEqual({
      url: 'https://imagens.exemplo.com/tenants/t1/variants/v1/abc-original.webp',
      thumbUrl: 'https://imagens.exemplo.com/tenants/t1/variants/v1/abc-thumb.webp',
    })
  })

  it('cai no redirect da própria API quando o R2 não tem domínio público', async () => {
    const { imageUrlsFor } = await loadWithEnv({
      STORAGE_PROVIDER: 'r2',
      R2_ENDPOINT: R2_API_ENDPOINT,
      PUBLIC_API_URL: 'https://api.exemplo.com',
    })

    expect(imageUrlsFor(IMAGE)).toEqual({
      url: `https://api.exemplo.com/img/${IMAGE.id}`,
      thumbUrl: `https://api.exemplo.com/img/${IMAGE.id}?v=thumb`,
    })
  })

  it('nunca devolve o endpoint da API S3 do R2 — foi o que quebrou as imagens em produção', async () => {
    const { imageUrlsFor } = await loadWithEnv({
      STORAGE_PROVIDER: 'r2',
      R2_ENDPOINT: R2_API_ENDPOINT,
      PUBLIC_API_URL: 'https://api.exemplo.com',
    })

    const { url, thumbUrl } = imageUrlsFor(IMAGE)

    // Esse host exige assinatura SigV4 e responde 400 InvalidArgument pra qualquer <img>.
    expect(url).not.toContain('r2.cloudflarestorage.com')
    expect(thumbUrl).not.toContain('r2.cloudflarestorage.com')
  })

  it('usa o host público do bucket quando o provider é S3', async () => {
    const { imageUrlsFor } = await loadWithEnv({
      STORAGE_PROVIDER: 's3',
      AWS_BUCKET_NAME: 'meu-bucket',
      AWS_REGION: 'us-west-2',
    })

    expect(imageUrlsFor(IMAGE).url).toBe(
      'https://meu-bucket.s3.us-west-2.amazonaws.com/tenants/t1/variants/v1/abc-original.webp',
    )
  })
})

describe('thumbKeyFor', () => {
  it('troca o sufixo -original.webp por -thumb.webp', async () => {
    const { thumbKeyFor } = await loadWithEnv({ STORAGE_PROVIDER: 's3' })

    expect(thumbKeyFor('tenants/t1/variants/v1/abc-original.webp')).toBe(
      'tenants/t1/variants/v1/abc-thumb.webp',
    )
  })

  it('devolve a chave intacta quando o sufixo não é o esperado', async () => {
    const { thumbKeyFor } = await loadWithEnv({ STORAGE_PROVIDER: 's3' })

    expect(thumbKeyFor('tenants/t1/variants/v1/legado.jpg')).toBe(
      'tenants/t1/variants/v1/legado.jpg',
    )
  })
})
