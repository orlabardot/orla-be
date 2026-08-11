import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma'
import { withImageUrls } from '../../images/image-url'

export type CatalogSort = 'name_asc' | 'name_desc' | 'newest'

export interface ListCatalogFilters {
  tenantId: string
  page: number
  limit: number
  q?: string
  frameType?: string
  categoryId?: string
  brandId?: string
  colorCode?: string
  sizeMin?: number
  sizeMax?: number
  bridgeMin?: number
  bridgeMax?: number
  templeMin?: number
  templeMax?: number
  tagIds?: string[]
  sort?: CatalogSort
}

const ORDER_BY: Record<CatalogSort, Prisma.ProductVariantOrderByWithRelationInput[]> = {
  name_asc: [{ product: { name: 'asc' } }, { colorCode: { sort: 'asc', nulls: 'last' } }],
  name_desc: [{ product: { name: 'desc' } }, { colorCode: { sort: 'asc', nulls: 'last' } }],
  newest: [{ product: { createdAt: 'desc' } }, { colorCode: { sort: 'asc', nulls: 'last' } }],
}

export async function listCatalogUseCase(filters: ListCatalogFilters) {
  const { tenantId, page, limit, q, tagIds, colorCode, frameType, categoryId, brandId, sizeMin, sizeMax, bridgeMin, bridgeMax, templeMin, templeMax, sort } = filters
  const skip = (page - 1) * limit

  const productWhere: Prisma.ProductWhereInput = {
    tenantId,
    deletedAt: null,
    isActive: true,
  }

  if (frameType) productWhere.frameType = frameType
  if (categoryId) productWhere.categoryId = categoryId
  if (brandId) productWhere.brandId = brandId

  if (sizeMin || sizeMax) {
    productWhere.sizeMm = {}
    if (sizeMin) productWhere.sizeMm.gte = new Prisma.Decimal(sizeMin)
    if (sizeMax) productWhere.sizeMm.lte = new Prisma.Decimal(sizeMax)
  }

  if (bridgeMin || bridgeMax) {
    productWhere.bridgeSizeMm = {}
    if (bridgeMin) productWhere.bridgeSizeMm.gte = new Prisma.Decimal(bridgeMin)
    if (bridgeMax) productWhere.bridgeSizeMm.lte = new Prisma.Decimal(bridgeMax)
  }

  if (templeMin || templeMax) {
    productWhere.templeSizeMm = {}
    if (templeMin) productWhere.templeSizeMm.gte = new Prisma.Decimal(templeMin)
    if (templeMax) productWhere.templeSizeMm.lte = new Prisma.Decimal(templeMax)
  }

  if (tagIds?.length) {
    productWhere.productTags = { some: { tagId: { in: tagIds } } }
  }

  const variantWhere: Prisma.ProductVariantWhereInput = {
    deletedAt: null,
    isActive: true,
    product: productWhere,
  }

  if (colorCode) variantWhere.colorCode = colorCode

  if (q) {
    variantWhere.OR = [
      { skuVariant: { contains: q, mode: 'insensitive' } },
      { colorLabel: { contains: q, mode: 'insensitive' } },
      { product: { name: { contains: q, mode: 'insensitive' } } },
      { product: { sku: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where: variantWhere,
      skip,
      take: limit,
      orderBy: ORDER_BY[sort ?? 'name_asc'],
      include: {
        product: {
          include: {
            brand: { select: { name: true } },
            category: { select: { name: true } },
          },
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 3,
        },
      },
    }),
    prisma.productVariant.count({ where: variantWhere }),
  ])

  const data = variants.map((v) => {
    const images = withImageUrls(v.images)

    return {
      variantId: v.id,
      productId: v.product.id,
      skuVariant: v.skuVariant,
      colorCode: v.colorCode,
      colorLabel: v.colorLabel,
      // Grade do catálogo usa o thumb de 400px, não o original de 1200px: o thumb já era
      // gerado e enviado no upload, mas nunca chegava a ser servido. A versão cheia da
      // principal continua acessível em imageUrls[0] (a ordenação põe a primária primeiro).
      primaryImageUrl: images[0]?.thumbUrl ?? null,
      imageUrls: images.map((img) => img.url),
      productName: v.product.name,
      productSku: v.product.sku,
      frameType: v.product.frameType,
      sizeMm: v.product.sizeMm ? Number(v.product.sizeMm) : null,
      bridgeSizeMm: v.product.bridgeSizeMm ? Number(v.product.bridgeSizeMm) : null,
      templeSizeMm: v.product.templeSizeMm ? Number(v.product.templeSizeMm) : null,
      gender: v.product.gender,
      brandName: v.product.brand?.name ?? null,
      categoryName: v.product.category?.name ?? null,
    }
  })

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
