import { prisma } from '../../lib/prisma'

export const imagesRepository = {
  async findById(id: string) {
    return prisma.variantImage.findUnique({ where: { id } })
  },

  async findByVariant(variantId: string) {
    return prisma.variantImage.findMany({
      where: { variantId },
      orderBy: { sortOrder: 'asc' },
    })
  },

  async hasPrimary(variantId: string) {
    const primary = await prisma.variantImage.findFirst({
      where: { variantId, isPrimary: true },
      select: { id: true },
    })
    return !!primary
  },

  async create(data: {
    variantId: string
    storageKey: string
    url: string
    isPrimary: boolean
    sortOrder: number
  }) {
    return prisma.variantImage.create({ data })
  },

  async delete(id: string) {
    return prisma.variantImage.delete({ where: { id } })
  },

  async countByVariant(variantId: string) {
    return prisma.variantImage.count({ where: { variantId } })
  },

  async setPrimary(variantId: string, imageId: string) {
    // Remove primary de todas as imagens da variante, depois seta a nova
    await prisma.$transaction([
      prisma.variantImage.updateMany({
        where: { variantId, isPrimary: true },
        data: { isPrimary: false },
      }),
      prisma.variantImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ])
  },

  async promoteNextPrimary(variantId: string) {
    const next = await prisma.variantImage.findFirst({
      where: { variantId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    })
    if (next) {
      await prisma.variantImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      })
    }
  },
}
