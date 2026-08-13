import { prisma } from '../../src/lib/prisma'

export async function resetDatabase() {
  // Deletar na ordem correta respeitando foreign keys. Faltava order/orderItem
  // aqui — Order.userId é onDelete: Restrict, então qualquer pedido deixado
  // por um teste travava (silenciosamente, dentro da transaction) a limpeza
  // de user/tenant, poluindo o banco pros testes seguintes.
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
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
