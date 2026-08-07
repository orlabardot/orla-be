import { prisma } from '../../lib/prisma'

const settingsSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  whatsappPhone: true,
}

export const tenantRepository = {
  async findSettings(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
      select: settingsSelect,
    })
  },

  async updateSettings(id: string, data: { whatsappPhone?: string | null }) {
    return prisma.tenant.update({
      where: { id },
      data,
      select: settingsSelect,
    })
  },
}
