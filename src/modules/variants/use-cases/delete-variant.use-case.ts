import { variantsRepository } from '../variants.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  productId: string
  variantId: string
}

export async function deleteVariantUseCase(input: Input) {
  const variant = await variantsRepository.findById(input.variantId)
  if (!variant || variant.tenantId !== input.tenantId || variant.productId !== input.productId) {
    throw new ResourceNotFoundError('Variant', input.variantId)
  }

  await variantsRepository.softDelete(input.variantId)
}
