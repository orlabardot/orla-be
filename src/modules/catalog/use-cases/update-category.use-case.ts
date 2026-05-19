import slugify from 'slugify'
import { categoriesRepository } from '../catalog.repository'
import { ConflictError, ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
  name: string
}

export async function updateCategoryUseCase(input: Input) {
  const category = await categoriesRepository.findById(input.tenantId, input.id)
  if (!category) {
    throw new ResourceNotFoundError('Category', input.id)
  }

  const slug = slugify(input.name, { lower: true, strict: true })

  const existing = await categoriesRepository.findBySlug(input.tenantId, slug)
  if (existing && existing.id !== input.id) {
    throw new ConflictError(`Category "${input.name}" already exists`)
  }

  return categoriesRepository.update(input.id, { name: input.name, slug })
}
