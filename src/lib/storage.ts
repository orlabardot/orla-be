import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env'

export interface StorageProvider {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
  /**
   * URL que um browser consegue abrir sem assinatura, ou `null` quando o bucket
   * não tem leitura pública configurada. Devolver `null` é o comportamento correto
   * pra R2 sem `R2_PUBLIC_URL` — o endpoint da API S3 (`R2_ENDPOINT`) exige SigV4 e
   * responde 400 `InvalidArgument: Authorization` pra qualquer `<img>`.
   */
  getPublicUrl(key: string): string | null
}

function createS3Storage(): StorageProvider {
  const client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    ...(env.STORAGE_PROVIDER === 'r2' && env.R2_ENDPOINT
      ? { endpoint: env.R2_ENDPOINT, forcePathStyle: false }
      : {}),
  })

  const bucket = env.AWS_BUCKET_NAME

  return {
    async upload(key: string, buffer: Buffer, contentType: string) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      )
      return key
    },

    async delete(key: string) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      )
    },

    async getSignedUrl(key: string, expiresIn = 3600) {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key })
      return getSignedUrl(client, command, { expiresIn })
    },

    getPublicUrl(key: string) {
      if (env.STORAGE_PROVIDER === 'r2') {
        // Só o domínio público de leitura serve. Sem ele, quem chama usa o fallback.
        return env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : null
      }
      return `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
    },
  }
}

export const storage: StorageProvider = createS3Storage()
