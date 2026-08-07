import { ordersRepository } from '../orders.repository'
import { ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
  status: 'pendente' | 'atendido'
}

export async function updateOrderStatusUseCase(input: Input) {
  const order = await ordersRepository.findById(input.tenantId, input.id)
  if (!order) {
    throw new ResourceNotFoundError('Order', input.id)
  }

  return ordersRepository.updateStatus(input.id, input.status)
}
