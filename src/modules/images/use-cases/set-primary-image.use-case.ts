import { imagesRepository } from '../images.repository'
import { variantsRepository } from '../../variants/variants.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  variantId: string
  imageId: string
}

export async function setPrimaryImageUseCase(input: Input) {
  const variant = await variantsRepository.findById(input.variantId)
  if (!variant || variant.tenantId !== input.tenantId) {
    throw new ResourceNotFoundError('Variant', input.variantId)
  }

  const image = await imagesRepository.findById(input.imageId)
  if (!image || image.variantId !== input.variantId) {
    throw new ResourceNotFoundError('Image', input.imageId)
  }

  await imagesRepository.setPrimary(input.variantId, input.imageId)

  return { ...image, isPrimary: true }
}
