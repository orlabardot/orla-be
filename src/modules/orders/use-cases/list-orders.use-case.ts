import { ordersRepository } from '../orders.repository'

interface Input {
  tenantId: string
  userId: string
  role: string
}

// Admin vê todos os pedidos do tenant; cliente vê só os próprios.
export async function listOrdersUseCase(input: Input) {
  if (input.role === 'admin') {
    return ordersRepository.findAllByTenant(input.tenantId)
  }
  return ordersRepository.findAllByUser(input.tenantId, input.userId)
}
