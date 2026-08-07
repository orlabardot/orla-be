import { prisma } from '../../lib/prisma'

interface CreateOrderData {
  tenantId: string
  userId: string
  cnpj: string
  contactPhone: string
  items: {
    variantId: string
    skuVariant: string
    productName: string
    colorLabel: string | null
    quantity: number
  }[]
}

export const ordersRepository = {
  async create(data: CreateOrderData) {
    return prisma.order.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        cnpj: data.cnpj,
        contactPhone: data.contactPhone,
        items: {
          create: data.items.map((item) => ({
            variantId: item.variantId,
            skuVariant: item.skuVariant,
            productName: item.productName,
            colorLabel: item.colorLabel,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    })
  },

  async findAllByTenant(tenantId: string) {
    return prisma.order.findMany({
      where: { tenantId },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async findAllByUser(tenantId: string, userId: string) {
    return prisma.order.findMany({
      where: { tenantId, userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
  },

  async findById(tenantId: string, id: string) {
    return prisma.order.findFirst({
      where: { id, tenantId },
      include: { items: true },
    })
  },

  async updateStatus(id: string, status: string) {
    return prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    })
  },
}
