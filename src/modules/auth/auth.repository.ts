import { prisma } from '../../lib/prisma'

export const authRepository = {
  async findUserByEmail(tenantId: string, email: string) {
    return prisma.user.findFirst({
      where: {
        tenantId,
        email,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    })
  },
}
