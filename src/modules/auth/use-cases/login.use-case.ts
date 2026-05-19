import bcrypt from 'bcryptjs'
import { authRepository } from '../auth.repository'
import { UnauthorizedError } from '../../../errors/app-errors'

interface LoginInput {
  tenantId: string
  email: string
  password: string
}

interface LoginOutput {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  token: string
  signToken: (payload: object) => string
}

// O use case retorna os dados necessários para o handler assinar o JWT
// (a assinatura fica na camada HTTP pois depende do Fastify)
interface ExecuteOutput {
  user: {
    id: string
    tenantId: string
    name: string
    email: string
    role: string
  }
}

export async function loginUseCase(input: LoginInput): Promise<ExecuteOutput> {
  const user = await authRepository.findUserByEmail(input.tenantId, input.email)

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
  }
}
