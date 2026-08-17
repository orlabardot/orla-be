import { productsRepository } from '../products.repository'
import { ConflictError, ResourceNotFoundError } from '../../../errors/app-errors'
import { categoriesRepository, brandsRepository, tagsRepository } from '../../catalog/catalog.repository'

interface Input {
  tenantId: string
  id: string
  sku?: string
  name?: string
  description?: string
  categoryId?: string | null
  brandId?: string | null
  frameType?: string
  sizeMm?: number
  bridgeSizeMm?: number
  templeSizeMm?: number
  gender?: string
  isActive?: boolean
  tagIds?: string[]
}

export async function updateProductUseCase(input: Input) {
  const product = await productsRepository.findById(input.tenantId, input.id)
  if (!product) {
    throw new ResourceNotFoundError('Product', input.id)
  }

  // SKU único por tenant (ignora o próprio produto)
  if (input.sku && input.sku !== product.sku) {
    const existingSku = await productsRepository.findBySku(input.tenantId, input.sku)
    if (existingSku) {
      throw new ConflictError(`Product with SKU "${input.sku}" already exists`)
    }
  }

  // Validar categoryId se fornecido
  if (input.categoryId) {
    const category = await categoriesRepository.findById(input.tenantId, input.categoryId)
    if (!category) {
      throw new ResourceNotFoundError('Category', input.categoryId)
    }
  }

  // Validar brandId se fornecido
  if (input.brandId) {
    const brand = await brandsRepository.findById(input.tenantId, input.brandId)
    if (!brand) {
      throw new ResourceNotFoundError('Brand', input.brandId)
    }
  }

  // Validar tags se fornecidas
  if (input.tagIds?.length) {
    for (const tagId of input.tagIds) {
      const tag = await tagsRepository.findById(input.tenantId, tagId)
      if (!tag) {
        throw new ResourceNotFoundError('Tag', tagId)
      }
    }
  }

  const { tenantId, id, ...data } = input
  return productsRepository.update(tenantId, id, data)
}
