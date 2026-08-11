import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { withVariantsImageUrls } from '../images/image-url'

export interface ListProductsFilters {
  tenantId: string
  page: number
  limit: number
  q?: string
  frameType?: string
  categoryId?: string
  brandId?: string
  colorCode?: string
  bridgeMin?: number
  bridgeMax?: number
  templeMin?: number
  templeMax?: number
  tagIds?: string[]
}

export const productsRepository = {
  async create(data: {
    tenantId: string
    sku: string
    name: string
    description?: string
    categoryId?: string
    brandId?: string
    frameType?: string
    sizeMm?: number
    bridgeSizeMm?: number
    templeSizeMm?: number
    gender?: string
    createdBy?: string
    tagIds?: string[]
  }) {
    const { tagIds, sizeMm, bridgeSizeMm, templeSizeMm, ...rest } = data

    return prisma.product.create({
      data: {
        ...rest,
        sizeMm: sizeMm ? new Prisma.Decimal(sizeMm) : undefined,
        bridgeSizeMm: bridgeSizeMm ? new Prisma.Decimal(bridgeSizeMm) : undefined,
        templeSizeMm: templeSizeMm ? new Prisma.Decimal(templeSizeMm) : undefined,
        productTags: tagIds?.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        productTags: { include: { tag: { select: { id: true, name: true } } } },
      },
    })
  },

  async findById(tenantId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        productTags: { include: { tag: { select: { id: true, name: true } } } },
        variants: {
          where: { deletedAt: null },
          orderBy: { colorCode: { sort: 'asc', nulls: 'last' } },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })

    if (!product) return null

    return { ...product, variants: withVariantsImageUrls(product.variants) }
  },

  async findBySku(tenantId: string, sku: string) {
    return prisma.product.findFirst({
      where: { tenantId, sku, deletedAt: null },
      select: { id: true },
    })
  },

  async list(filters: ListProductsFilters) {
    const { tenantId, page, limit, q, tagIds, ...rest } = filters
    const skip = (page - 1) * limit

    // Construir where dinâmico
    const where: Prisma.ProductWhereInput = {
      tenantId,
      deletedAt: null,
      isActive: true,
    }

    if (rest.frameType) where.frameType = rest.frameType
    if (rest.categoryId) where.categoryId = rest.categoryId
    if (rest.brandId) where.brandId = rest.brandId

    if (rest.bridgeMin || rest.bridgeMax) {
      where.bridgeSizeMm = {}
      if (rest.bridgeMin) where.bridgeSizeMm.gte = new Prisma.Decimal(rest.bridgeMin)
      if (rest.bridgeMax) where.bridgeSizeMm.lte = new Prisma.Decimal(rest.bridgeMax)
    }

    if (rest.templeMin || rest.templeMax) {
      where.templeSizeMm = {}
      if (rest.templeMin) where.templeSizeMm.gte = new Prisma.Decimal(rest.templeMin)
      if (rest.templeMax) where.templeSizeMm.lte = new Prisma.Decimal(rest.templeMax)
    }

    if (tagIds?.length) {
      where.productTags = {
        some: { tagId: { in: tagIds } },
      }
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        {
          variants: {
            some: {
              OR: [
                { skuVariant: { contains: q, mode: 'insensitive' } },
                { colorLabel: { contains: q, mode: 'insensitive' } },
              ],
              deletedAt: null,
            },
          },
        },
      ]
    }

    // Filtro por colorCode nas variantes
    const variantWhere: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
      isActive: true,
    }
    if (rest.colorCode) {
      variantWhere.colorCode = rest.colorCode
      // Também filtrar products que tenham essa variante
      where.variants = {
        some: { colorCode: rest.colorCode, deletedAt: null },
      }
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          variants: {
            where: variantWhere,
            orderBy: { colorCode: { sort: 'asc', nulls: 'last' } },
            include: {
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ])

    return {
      data: data.map((product) => ({
        ...product,
        variants: withVariantsImageUrls(product.variants),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  },

  async update(
    id: string,
    data: {
      sku?: string
      name?: string
      description?: string
      categoryId?: string | null
      brandId?: string | null
      frameType?: string
      sizeMm?: number
      bridgeSizeMm?: number
      templeSizeMm?: number
      gender?: string
      isActive?: boolean
      tagIds?: string[]
    },
  ) {
    const { tagIds, sizeMm, bridgeSizeMm, templeSizeMm, ...rest } = data

    // Se tagIds foi informado, recriar relações
    if (tagIds !== undefined) {
      await prisma.productTag.deleteMany({ where: { productId: id } })
    }

    return prisma.product.update({
      where: { id },
      data: {
        ...rest,
        sizeMm: sizeMm !== undefined ? new Prisma.Decimal(sizeMm) : undefined,
        bridgeSizeMm: bridgeSizeMm !== undefined ? new Prisma.Decimal(bridgeSizeMm) : undefined,
        templeSizeMm: templeSizeMm !== undefined ? new Prisma.Decimal(templeSizeMm) : undefined,
        productTags: tagIds?.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        productTags: { include: { tag: { select: { id: true, name: true } } } },
      },
    })
  },

  async softDelete(id: string) {
    return prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })
  },
}
