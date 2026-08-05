import bcrypt from 'bcryptjs'
import { usersRepository } from '../users.repository'
import { BadRequestError, ConflictError, ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  id: string
  actingUserId: string
  name?: string
  email?: string
  role?: string
  isActive?: boolean
  password?: string
}

export async function updateUserUseCase(input: Input) {
  const user = await usersRepository.findById(input.tenantId, input.id)
  if (!user) {
    throw new ResourceNotFoundError('User', input.id)
  }

  // Impede que um admin se desative ou remova o próprio acesso e fique
  // trancado fora do sistema.
  if (input.id === input.actingUserId) {
    if (input.isActive === false) {
      throw new BadRequestError('Você não pode desativar sua própria conta')
    }
    if (input.role === 'employee') {
      throw new BadRequestError('Você não pode remover seu próprio acesso de admin')
    }
  }

  if (input.email && input.email !== user.email) {
    const existing = await usersRepository.findByEmail(input.tenantId, input.email)
    if (existing) {
      throw new ConflictError(`Email "${input.email}" already in use`)
    }
  }

  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined

  return usersRepository.update(input.id, {
    name: input.name,
    email: input.email,
    role: input.role,
    isActive: input.isActive,
    passwordHash,
  })
}
