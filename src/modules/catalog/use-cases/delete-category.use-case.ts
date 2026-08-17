import { categoriesRepository } from '../catalog.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
}

export async function deleteCategoryUseCase(input: Input) {
  const category = await categoriesRepository.findById(input.tenantId, input.id)
  if (!category) {
    throw new ResourceNotFoundError('Category', input.id)
  }

  await categoriesRepository.delete(input.tenantId, input.id)
}
