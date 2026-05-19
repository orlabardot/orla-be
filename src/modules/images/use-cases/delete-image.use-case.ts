import { imagesRepository } from '../images.repository'
import { variantsRepository } from '../../variants/variants.repository'
import { storage } from '../../../lib/storage'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  variantId: string
  imageId: string
}

export async function deleteImageUseCase(input: Input) {
  // Validar variante pertence ao tenant
  const variant = await variantsRepository.findById(input.variantId)
  if (!variant || variant.tenantId !== input.tenantId) {
    throw new ResourceNotFoundError('Variant', input.variantId)
  }

  const image = await imagesRepository.findById(input.imageId)
  if (!image || image.variantId !== input.variantId) {
    throw new ResourceNotFoundError('Image', input.imageId)
  }

  // Remover do S3 (original + thumb)
  const thumbKey = image.storageKey.replace('-original.webp', '-thumb.webp')
  await Promise.all([
    storage.delete(image.storageKey),
    storage.delete(thumbKey),
  ])

  const wasPrimary = image.isPrimary

  // Remover do banco
  await imagesRepository.delete(input.imageId)

  // Se era primária, promover a próxima
  if (wasPrimary) {
    await imagesRepository.promoteNextPrimary(input.variantId)
  }
}
