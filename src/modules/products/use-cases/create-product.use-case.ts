import { productsRepository } from '../products.repository'
import { ConflictError, ResourceNotFoundError } from '../../../errors/app-errors'
import { categoriesRepository } from '../../catalog/catalog.repository'
import { brandsRepository } from '../../catalog/catalog.repository'
import { tagsRepository } from '../../catalog/catalog.repository'

interface Input {
  tenantId: string
  sku: string
  name: string
  description?: string
  categoryId?: string
  brandId?: string
  frameType?: string
  sizeMm?: number
  bridgeSizeMm?: number
  templeSizeMm?: number
  gender?: string
  createdBy: string
  tagIds?: string[]
}

export async function createProductUseCase(input: Input) {
  // SKU único por tenant
  const existingSku = await productsRepository.findBySku(input.tenantId, input.sku)
  if (existingSku) {
    throw new ConflictError(`Product with SKU "${input.sku}" already exists`)
  }

  // Validar que categoryId pertence ao mesmo tenant
  if (input.categoryId) {
    const category = await categoriesRepository.findById(input.tenantId, input.categoryId)
    if (!category) {
      throw new ResourceNotFoundError('Category', input.categoryId)
    }
  }

  // Validar que brandId pertence ao mesmo tenant
  if (input.brandId) {
    const brand = await brandsRepository.findById(input.tenantId, input.brandId)
    if (!brand) {
      throw new ResourceNotFoundError('Brand', input.brandId)
    }
  }

  // Validar que todas as tags pertencem ao mesmo tenant
  if (input.tagIds?.length) {
    for (const tagId of input.tagIds) {
      const tag = await tagsRepository.findById(input.tenantId, tagId)
      if (!tag) {
        throw new ResourceNotFoundError('Tag', tagId)
      }
    }
  }

  return productsRepository.create(input)
}
