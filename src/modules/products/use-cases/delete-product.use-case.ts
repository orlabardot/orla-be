import { productsRepository } from '../products.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
}

export async function deleteProductUseCase(input: Input) {
  const product = await productsRepository.findById(input.tenantId, input.id)
  if (!product) {
    throw new ResourceNotFoundError('Product', input.id)
  }

  await productsRepository.softDelete(input.tenantId, input.id)
}
