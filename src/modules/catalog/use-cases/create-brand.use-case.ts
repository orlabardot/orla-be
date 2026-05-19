import slugify from 'slugify'
import { brandsRepository } from '../catalog.repository'
import { ConflictError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  name: string
}

export async function createBrandUseCase(input: Input) {
  const slug = slugify(input.name, { lower: true, strict: true })

  const existing = await brandsRepository.findBySlug(input.tenantId, slug)
  if (existing) {
    throw new ConflictError(`Brand "${input.name}" already exists`)
  }

  return brandsRepository.create({
    tenantId: input.tenantId,
    name: input.name,
    slug,
  })
}
