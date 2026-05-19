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
  getPublicUrl(key: string): string
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
      if (env.STORAGE_PROVIDER === 'r2' && env.R2_ENDPOINT) {
        return `${env.R2_ENDPOINT}/${bucket}/${key}`
      }
      return `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
    },
  }
}

export const storage: StorageProvider = createS3Storage()
