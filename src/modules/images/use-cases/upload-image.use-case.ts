import sharp from 'sharp'
import { v4 as uuid } from 'uuid'
import { variantsRepository } from '../../variants/variants.repository'
import { imagesRepository } from '../images.repository'
import { storage } from '../../../lib/storage'
import { BadRequestError, ResourceNotFoundError } from '../../../errors/app-errors'

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// Magic bytes para validação real do tipo de arquivo
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
}

function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const signatures = MAGIC_BYTES[mimetype]
  if (!signatures) return false
  return signatures.some((sig) =>
    sig.every((byte, i) => buffer[i] === byte),
  )
}

interface Input {
  tenantId: string
  variantId: string
  buffer: Buffer
  mimetype: string
  fileSize: number
}

export async function uploadImageUseCase(input: Input) {
  // Validar variante pertence ao tenant
  const variant = await variantsRepository.findById(input.variantId)
  if (!variant || variant.tenantId !== input.tenantId) {
    throw new ResourceNotFoundError('Variant', input.variantId)
  }

  // Validar mimetype do header
  if (!ALLOWED_MIMETYPES.includes(input.mimetype)) {
    throw new BadRequestError('File must be JPEG, PNG or WebP')
  }

  // Validar magic bytes — não confiar apenas no Content-Type
  if (!validateMagicBytes(input.buffer, input.mimetype)) {
    throw new BadRequestError('File content does not match the declared type')
  }

  // Validar tamanho
  if (input.fileSize > MAX_SIZE) {
    throw new BadRequestError('File size must be under 10MB')
  }

  const fileId = uuid()
  const basePath = `tenants/${input.tenantId}/variants/${input.variantId}`

  // Processar com sharp — original
  const originalBuffer = await sharp(input.buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  // Processar com sharp — thumbnail
  const thumbBuffer = await sharp(input.buffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  // Upload para S3
  const originalKey = `${basePath}/${fileId}-original.webp`
  const thumbKey = `${basePath}/${fileId}-thumb.webp`

  await Promise.all([
    storage.upload(originalKey, originalBuffer, 'image/webp'),
    storage.upload(thumbKey, thumbBuffer, 'image/webp'),
  ])

  // Se não tem imagem primária, esta será a primária
  const hasPrimary = await imagesRepository.hasPrimary(input.variantId)
  const count = await imagesRepository.countByVariant(input.variantId)

  const image = await imagesRepository.create({
    variantId: input.variantId,
    storageKey: originalKey,
    url: storage.getPublicUrl(originalKey),
    isPrimary: !hasPrimary,
    sortOrder: count,
  })

  return {
    ...image,
    thumbUrl: storage.getPublicUrl(thumbKey),
  }
}
