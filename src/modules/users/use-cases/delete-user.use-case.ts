import { usersRepository } from '../users.repository'
import { BadRequestError, ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
  actingUserId: string
}

export async function deleteUserUseCase(input: Input) {
  const user = await usersRepository.findById(input.tenantId, input.id)
  if (!user) {
    throw new ResourceNotFoundError('User', input.id)
  }

  if (input.id === input.actingUserId) {
    throw new BadRequestError('Você não pode excluir a própria conta')
  }

  await usersRepository.softDelete(input.id)
}
