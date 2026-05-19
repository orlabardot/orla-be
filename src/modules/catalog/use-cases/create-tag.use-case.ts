import slugify from 'slugify'
import { tagsRepository } from '../catalog.repository'
import { ConflictError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  name: string
}

export async function createTagUseCase(input: Input) {
  const slug = slugify(input.name, { lower: true, strict: true })

  const existing = await tagsRepository.findBySlug(input.tenantId, slug)
  if (existing) {
    throw new ConflictError(`Tag "${input.name}" already exists`)
  }

  return tagsRepository.create({
    tenantId: input.tenantId,
    name: input.name,
    slug,
  })
}
