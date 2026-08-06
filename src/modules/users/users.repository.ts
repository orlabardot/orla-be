import { prisma } from '../../lib/prisma'

const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
}

export const usersRepository = {
  async findAll(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      select: publicSelect,
      orderBy: { name: 'asc' },
    })
  },

  async findById(tenantId: string, id: string) {
    return prisma.user.findFirst({
      where: { id, tenantId },
      select: publicSelect,
    })
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })
  },

  async create(data: {
    tenantId: string
    name: string
    email: string
    passwordHash: string
    role: string
  }) {
    return prisma.user.create({ data, select: publicSelect })
  },

  async update(
    id: string,
    data: {
      name?: string
      email?: string
      role?: string
      isActive?: boolean
      passwordHash?: string
    },
  ) {
    return prisma.user.update({ where: { id }, data, select: publicSelect })
  },
}
