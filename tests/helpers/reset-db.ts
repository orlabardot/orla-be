import { prisma } from '../../src/lib/prisma'

export async function resetDatabase() {
  // Deletar na ordem correta respeitando foreign keys
  await prisma.$transaction([
    prisma.variantImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.productTag.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ])
}
