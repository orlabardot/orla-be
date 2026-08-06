import { prisma } from '../../lib/prisma'

export const authRepository = {
  async findUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
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
        tenant: {
          select: { id: true, slug: true, name: true, logoUrl: true },
        },
      },
    })
  },
}
