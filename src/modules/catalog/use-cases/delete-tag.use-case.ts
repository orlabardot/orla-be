import { tagsRepository } from '../catalog.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
}

export async function deleteTagUseCase(input: Input) {
  const tag = await tagsRepository.findById(input.tenantId, input.id)
  if (!tag) {
    throw new ResourceNotFoundError('Tag', input.id)
  }

  await tagsRepository.delete(input.tenantId, input.id)
}
