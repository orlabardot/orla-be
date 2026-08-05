import { usersRepository } from '../users.repository'

interface Input {
  tenantId: string
}

export async function listUsersUseCase(input: Input) {
  return usersRepository.findAll(input.tenantId)
}
