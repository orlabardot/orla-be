import bcrypt from 'bcryptjs'
import { usersRepository } from '../../users/users.repository'
import { BadRequestError, ResourceNotFoundError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  userId: string
  currentPassword: string
  newPassword: string
}

export async function changePasswordUseCase(input: Input) {
  const user = await usersRepository.findByIdWithPasswordHash(input.tenantId, input.userId)
  if (!user) {
    throw new ResourceNotFoundError('User', input.userId)
  }

  const passwordMatch = await bcrypt.compare(input.currentPassword, user.passwordHash)
  if (!passwordMatch) {
    // 400, não 401: o usuário está autenticado (JWT válido), só errou a
    // senha atual num campo de formulário. Um 401 aqui dispara o
    // interceptor global do frontend que desloga em qualquer 401 (ver
    // src/lib/axios.ts do orla-fe) — deslogaria o usuário só por errar a
    // senha atual, que é o oposto do que se quer nesse fluxo.
    throw new BadRequestError('Senha atual incorreta')
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12)
  await usersRepository.update(input.tenantId, input.userId, { passwordHash })
}
