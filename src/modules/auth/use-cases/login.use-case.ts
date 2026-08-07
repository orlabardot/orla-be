import bcrypt from 'bcryptjs'
import { authRepository } from '../auth.repository'
import { UnauthorizedError } from '../../../errors/app-errors'

interface LoginInput {
  email: string
  password: string
}

interface ExecuteOutput {
  user: {
    id: string
    tenantId: string
    name: string
    email: string
    role: string
  }
  tenant: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
    whatsappPhone: string | null
  }
}

export async function loginUseCase(input: LoginInput): Promise<ExecuteOutput> {
  const user = await authRepository.findUserByEmail(input.email)

  if (!user) {
    // Mensagem genérica para não revelar se o email existe
    throw new UnauthorizedError('Invalid credentials')
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash)

  if (!passwordMatch) {
    throw new UnauthorizedError('Invalid credentials')
  }

  return {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    tenant: user.tenant,
  }
}
