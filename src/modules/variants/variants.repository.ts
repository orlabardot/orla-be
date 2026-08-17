import { prisma } from '../../lib/prisma'
import { withVariantImageUrls, withVariantsImageUrls } from '../images/image-url'

export const variantsRepository = {
  async findById(id: string) {
    const variant = await prisma.productVariant.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return variant && withVariantImageUrls(variant)
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
    const variants = await prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      orderBy: { colorCode: { sort: 'asc', nulls: 'last' } },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return withVariantsImageUrls(variants)
  },

  async create(data: {
    tenantId: string
    productId: string
    skuVariant: string
    colorCode?: string
    colorLabel?: string
  }) {
    const variant = await prisma.productVariant.create({
      data,
      include: {
        images: true,
      },
    })

    return withVariantImageUrls(variant)
  },

  async createMany(
    tenantId: string,
    productId: string,
    variants: Array<{ skuVariant: string; colorCode?: string; colorLabel?: string }>,
  ) {
    const created = await prisma.$transaction(
      variants.map((variant) =>
        prisma.productVariant.create({
          data: { tenantId, productId, ...variant },
          include: { images: true },
        }),
      ),
    )

    return withVariantsImageUrls(created)
  },

  async update(
    tenantId: string,
    id: string,
    data: {
      colorLabel?: string
      isActive?: boolean
    },
  ) {
    const variant = await prisma.productVariant.update({
      where: { id, tenantId },
      data,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return withVariantImageUrls(variant)
  },

  async softDelete(tenantId: string, id: string) {
    return prisma.productVariant.update({
      where: { id, tenantId },
      data: { deletedAt: new Date(), isActive: false },
    })
  },
}
