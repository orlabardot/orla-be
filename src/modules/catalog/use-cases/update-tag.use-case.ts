import slugify from 'slugify'
import { tagsRepository } from '../catalog.repository'
import { ConflictError, ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
  name: string
}

export async function updateTagUseCase(input: Input) {
  const tag = await tagsRepository.findById(input.tenantId, input.id)
  if (!tag) {
    throw new ResourceNotFoundError('Tag', input.id)
  }

  const slug = slugify(input.name, { lower: true, strict: true })

  const existing = await tagsRepository.findBySlug(input.tenantId, slug)
  if (existing && existing.id !== input.id) {
    throw new ConflictError(`Tag "${input.name}" already exists`)
  }

  return tagsRepository.update(input.id, { name: input.name, slug })
}
