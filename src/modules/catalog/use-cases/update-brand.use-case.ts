import slugify from 'slugify'
import { brandsRepository } from '../catalog.repository'
import { ConflictError, ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
  name: string
}

export async function updateBrandUseCase(input: Input) {
  const brand = await brandsRepository.findById(input.tenantId, input.id)
  if (!brand) {
    throw new ResourceNotFoundError('Brand', input.id)
  }

  const slug = slugify(input.name, { lower: true, strict: true })

  const existing = await brandsRepository.findBySlug(input.tenantId, slug)
  if (existing && existing.id !== input.id) {
    throw new ConflictError(`Brand "${input.name}" already exists`)
  }

  return brandsRepository.update(input.tenantId, input.id, { name: input.name, slug })
}
