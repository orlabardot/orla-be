import { prisma } from '../../lib/prisma'

export const variantsRepository = {
  async findById(id: string) {
    return prisma.productVariant.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })
  },

  async findBySkuVariant(tenantId: string, skuVariant: string) {
    return prisma.productVariant.findFirst({
      where: { tenantId, skuVariant, deletedAt: null },
      select: { id: true },
    })
  },

  async findByProductAndColorCode(productId: string, colorCode: string) {
    return prisma.productVariant.findFirst({
      where: { productId, colorCode, deletedAt: null },
      select: { id: true },
    })
  },

  async findAllByProduct(productId: string) {
    return prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      orderBy: { colorCode: { sort: 'asc', nulls: 'last' } },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })
  },

  async create(data: {
    tenantId: string
    productId: string
    skuVariant: string
    colorCode?: string
    colorLabel?: string
  }) {
    return prisma.productVariant.create({
      data,
      include: {
        images: true,
      },
    })
  },

  async update(
    id: string,
    data: {
      colorLabel?: string
      isActive?: boolean
    },
  ) {
    return prisma.productVariant.update({
      where: { id },
      data,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })
  },

  async softDelete(id: string) {
    return prisma.productVariant.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })
  },
}
