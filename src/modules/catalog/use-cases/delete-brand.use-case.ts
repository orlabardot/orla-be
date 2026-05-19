import { brandsRepository } from '../catalog.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
}

export async function deleteBrandUseCase(input: Input) {
  const brand = await brandsRepository.findById(input.tenantId, input.id)
  if (!brand) {
    throw new ResourceNotFoundError('Brand', input.id)
  }

  await brandsRepository.delete(input.id)
}
