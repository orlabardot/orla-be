import slugify from 'slugify'
import { categoriesRepository } from '../catalog.repository'
import { ConflictError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  name: string
}

export async function createCategoryUseCase(input: Input) {
  const slug = slugify(input.name, { lower: true, strict: true })

  const existing = await categoriesRepository.findBySlug(input.tenantId, slug)
  if (existing) {
    throw new ConflictError(`Category "${input.name}" already exists`)
  }

  return categoriesRepository.create({
    tenantId: input.tenantId,
    name: input.name,
    slug,
  })
}
