import { variantsRepository } from '../variants.repository'
import { productsRepository } from '../../products/products.repository'
import { ConflictError, ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  productId: string
  skuVariant: string
  colorCode?: string
  colorLabel?: string
}

export async function createVariantUseCase(input: Input) {
  // Validar que o produto pertence ao tenant
  const product = await productsRepository.findById(input.tenantId, input.productId)
  if (!product) {
    throw new ResourceNotFoundError('Product', input.productId)
  }

  // skuVariant único por tenant
  const existingSku = await variantsRepository.findBySkuVariant(input.tenantId, input.skuVariant)
  if (existingSku) {
    throw new ConflictError(`Variant with SKU "${input.skuVariant}" already exists`)
  }

  // colorCode único por produto (se fornecido)
  if (input.colorCode) {
    const existingColor = await variantsRepository.findByProductAndColorCode(
      input.productId,
      input.colorCode,
    )
    if (existingColor) {
      throw new ConflictError(
        `Color code "${input.colorCode}" already exists for this product`,
      )
    }
  }

  return variantsRepository.create(input)
}
