import { variantsRepository } from '../variants.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  productId: string
  variantId: string
  colorLabel?: string
  isActive?: boolean
}

export async function updateVariantUseCase(input: Input) {
  const variant = await variantsRepository.findById(input.variantId)
  if (!variant || variant.tenantId !== input.tenantId || variant.productId !== input.productId) {
    throw new ResourceNotFoundError('Variant', input.variantId)
  }

  return variantsRepository.update(input.variantId, {
    colorLabel: input.colorLabel,
    isActive: input.isActive,
  })
}
