import bcrypt from 'bcryptjs'
import { usersRepository } from '../users.repository'
import { ConflictError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  name: string
  email: string
  password: string
  role: string
}

export async function createUserUseCase(input: Input) {
  const existing = await usersRepository.findByEmail(input.email)
  if (existing) {
    throw new ConflictError(`Email "${input.email}" already in use`)
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  return usersRepository.create({
    tenantId: input.tenantId,
    name: input.name,
    email: input.email,
    passwordHash,
    role: input.role,
  })
}
