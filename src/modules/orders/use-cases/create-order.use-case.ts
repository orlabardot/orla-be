import { prisma } from '../../../lib/prisma'
import { ordersRepository } from '../orders.repository'
import { ValidationError } from '../../../errors/app-errors'

interface OrderItemInput {
  variantId: string
  quantity: number
}

interface Input {
  tenantId: string
  userId: string
  cnpj: string
  contactPhone: string
  items: OrderItemInput[]
}

export async function createOrderUseCase(input: Input) {
  if (input.items.length === 0) {
    throw new ValidationError('Order must have at least one item')
  }

  const variantIds = input.items.map((item) => item.variantId)

  // Nunca confia em nome/SKU/cor vindos do cliente — busca do banco pra
  // montar o retrato (snapshot) que fica gravado no item do pedido.
  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: variantIds },
      tenantId: input.tenantId,
      deletedAt: null,
      isActive: true,
    },
    include: {
      product: { select: { name: true } },
    },
  })

  const variantById = new Map(variants.map((v) => [v.id, v]))
  const missing = variantIds.filter((id) => !variantById.has(id))
  if (missing.length > 0) {
    throw new ValidationError(`Invalid or inactive variants: ${missing.join(', ')}`)
  }

  const items = input.items.map((item) => {
    const variant = variantById.get(item.variantId)!
    return {
      variantId: variant.id,
      skuVariant: variant.skuVariant,
      productName: variant.product.name,
      colorLabel: variant.colorLabel,
      quantity: Math.max(1, Math.floor(item.quantity)),
    }
  })

  return ordersRepository.create({
    tenantId: input.tenantId,
    userId: input.userId,
    cnpj: input.cnpj,
    contactPhone: input.contactPhone,
    items,
  })
}
