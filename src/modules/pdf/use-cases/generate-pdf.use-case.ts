import { prisma } from '../../../lib/prisma'
import { generatePdfFromHtml } from '../../../lib/pdf'
import { buildCatalogHtml } from '../pdf.templates'
import { ValidationError } from '../../../errors/app-errors'

interface Input {
  tenantId: string
  tenantName: string
  variantIds: string[]
  clientName?: string
}

export async function generatePdfUseCase(input: Input) {
  // Buscar variantes ativas que pertencem ao tenant
  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: input.variantIds },
      tenantId: input.tenantId,
      deletedAt: null,
      isActive: true,
    },
    include: {
      product: {
        select: { name: true },
      },
      images: {
        where: { isPrimary: true },
        take: 1,
      },
    },
    orderBy: { skuVariant: 'asc' },
  })

  if (variants.length === 0) {
    throw new ValidationError('No valid variants found for the given IDs')
  }

  const templateData = variants.map((v) => ({
    skuVariant: v.skuVariant,
    colorLabel: v.colorLabel,
    productName: v.product.name,
    imageUrl: v.images[0]?.url ?? null,
  }))

  const html = buildCatalogHtml({
    variants: templateData,
    clientName: input.clientName,
    tenantName: input.tenantName,
  })

  return generatePdfFromHtml(html)
}
