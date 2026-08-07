import { variantsRepository } from '../variants.repository'
import { productsRepository } from '../../products/products.repository'
import { ConflictError, ResourceNotFoundError, ValidationError } from '../../../errors/app-errors'

interface VariantInput {
  skuVariant: string
  colorCode?: string
  colorLabel?: string
}

interface Input {
  tenantId: string
  productId: string
  variants: VariantInput[]
}

export async function bulkCreateVariantsUseCase(input: Input) {
  const product = await productsRepository.findById(input.tenantId, input.productId)
  if (!product) {
    throw new ResourceNotFoundError('Product', input.productId)
  }

  // skuVariant/colorCode duplicado dentro do próprio lote
  const skus = input.variants.map((v) => v.skuVariant)
  const dupSku = skus.find((sku, i) => skus.indexOf(sku) !== i)
  if (dupSku) {
    throw new ValidationError(`SKU "${dupSku}" está duplicado no lote`)
  }

  const colorCodes = input.variants.map((v) => v.colorCode).filter((c): c is string => !!c)
  const dupColor = colorCodes.find((code, i) => colorCodes.indexOf(code) !== i)
  if (dupColor) {
    throw new ValidationError(`Código de cor "${dupColor}" está duplicado no lote`)
  }

  // skuVariant único por tenant / colorCode único por produto (contra o que já existe)
  for (const variant of input.variants) {
    const existingSku = await variantsRepository.findBySkuVariant(
      input.tenantId,
      variant.skuVariant,
    )
    if (existingSku) {
      throw new ConflictError(`Variant with SKU "${variant.skuVariant}" already exists`)
    }

    if (variant.colorCode) {
      const existingColor = await variantsRepository.findByProductAndColorCode(
        input.productId,
        variant.colorCode,
      )
      if (existingColor) {
        throw new ConflictError(
          `Color code "${variant.colorCode}" already exists for this product`,
        )
      }
    }
  }

  return variantsRepository.createMany(input.tenantId, input.productId, input.variants)
}
