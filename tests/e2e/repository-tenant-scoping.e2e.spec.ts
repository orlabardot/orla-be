import { describe, it, expect, afterAll, afterEach } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { makeTenant } from '../factories/tenant.factory'
import { makeUser } from '../factories/user.factory'
import { resetDatabase } from '../helpers/reset-db'
import { productsRepository } from '../../src/modules/products/products.repository'
import { categoriesRepository, brandsRepository, tagsRepository } from '../../src/modules/catalog/catalog.repository'
import { usersRepository } from '../../src/modules/users/users.repository'
import { variantsRepository } from '../../src/modules/variants/variants.repository'
import { ordersRepository } from '../../src/modules/orders/orders.repository'

// Achado em auditoria de segurança: update/delete/softDelete dos
// repositories aceitavam só `{ id }` no `where` do Prisma, contando
// inteiramente com a checagem prévia feita na camada de use-case. Estes
// testes chamam os repositories DIRETO (sem passar pelo use-case), com o
// tenantId de um tenant que não é dono do registro — simulam exatamente um
// use-case futuro que esqueça de validar antes de mutar. Devem falhar (ou
// não fazer nada) em vez de mutar silenciosamente o dado de outro tenant.
describe('Repositories — isolamento por tenant em update/delete (defesa em profundidade)', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  afterEach(async () => {
    await resetDatabase()
  })

  it('products — update e softDelete de outro tenant são rejeitados', async () => {
    const owner = await makeTenant()
    const attacker = await makeTenant()
    const product = await productsRepository.create({ tenantId: owner.id, sku: 'X1', name: 'Original' })

    await expect(
      productsRepository.update(attacker.id, product.id, { name: 'Hacked' }),
    ).rejects.toThrow()
    await expect(productsRepository.softDelete(attacker.id, product.id)).rejects.toThrow()

    const untouched = await prisma.product.findUnique({ where: { id: product.id } })
    expect(untouched?.name).toBe('Original')
    expect(untouched?.deletedAt).toBeNull()
  })

  it('categories/brands/tags — update e delete de outro tenant são rejeitados', async () => {
    const owner = await makeTenant()
    const attacker = await makeTenant()

    const category = await categoriesRepository.create({ tenantId: owner.id, name: 'Cat', slug: 'cat' })
    const brand = await brandsRepository.create({ tenantId: owner.id, name: 'Brand', slug: 'brand' })
    const tag = await tagsRepository.create({ tenantId: owner.id, name: 'Tag', slug: 'tag' })

    await expect(
      categoriesRepository.update(attacker.id, category.id, { name: 'Hacked', slug: 'hacked' }),
    ).rejects.toThrow()
    await expect(categoriesRepository.delete(attacker.id, category.id)).rejects.toThrow()

    await expect(
      brandsRepository.update(attacker.id, brand.id, { name: 'Hacked', slug: 'hacked' }),
    ).rejects.toThrow()
    await expect(brandsRepository.delete(attacker.id, brand.id)).rejects.toThrow()

    await expect(
      tagsRepository.update(attacker.id, tag.id, { name: 'Hacked', slug: 'hacked' }),
    ).rejects.toThrow()
    await expect(tagsRepository.delete(attacker.id, tag.id)).rejects.toThrow()

    expect((await prisma.category.findUnique({ where: { id: category.id } }))?.name).toBe('Cat')
    expect((await prisma.brand.findUnique({ where: { id: brand.id } }))?.name).toBe('Brand')
    expect((await prisma.tag.findUnique({ where: { id: tag.id } }))?.name).toBe('Tag')
  })

  it('users — update e softDelete de outro tenant são rejeitados', async () => {
    const owner = await makeTenant()
    const attacker = await makeTenant()
    const { user } = await makeUser({ tenantId: owner.id, name: 'Original', role: 'employee' })

    await expect(
      usersRepository.update(attacker.id, user.id, { name: 'Hacked' }),
    ).rejects.toThrow()
    await expect(usersRepository.softDelete(attacker.id, user.id)).rejects.toThrow()

    const untouched = await prisma.user.findUnique({ where: { id: user.id } })
    expect(untouched?.name).toBe('Original')
    expect(untouched?.deletedAt).toBeNull()
  })

  it('variants — update e softDelete de outro tenant são rejeitados', async () => {
    const owner = await makeTenant()
    const attacker = await makeTenant()
    const product = await productsRepository.create({ tenantId: owner.id, sku: 'X1', name: 'Produto' })
    const variant = await variantsRepository.create({
      tenantId: owner.id,
      productId: product.id,
      skuVariant: 'X1 C1',
      colorCode: 'C1',
      colorLabel: 'Original',
    })

    await expect(
      variantsRepository.update(attacker.id, variant.id, { colorLabel: 'Hacked' }),
    ).rejects.toThrow()
    await expect(variantsRepository.softDelete(attacker.id, variant.id)).rejects.toThrow()

    const untouched = await prisma.productVariant.findUnique({ where: { id: variant.id } })
    expect(untouched?.colorLabel).toBe('Original')
    expect(untouched?.deletedAt).toBeNull()
  })

  it('orders — updateStatus de outro tenant é rejeitado', async () => {
    const owner = await makeTenant()
    const attacker = await makeTenant()
    const { user } = await makeUser({ tenantId: owner.id, role: 'employee' })
    const product = await productsRepository.create({ tenantId: owner.id, sku: 'X1', name: 'Produto' })
    const variant = await variantsRepository.create({
      tenantId: owner.id,
      productId: product.id,
      skuVariant: 'X1 C1',
    })
    const order = await ordersRepository.create({
      tenantId: owner.id,
      userId: user.id,
      cnpj: '00000000000191',
      contactPhone: '11999999999',
      items: [{ variantId: variant.id, skuVariant: variant.skuVariant, productName: 'Produto', colorLabel: null, quantity: 1 }],
    })

    await expect(
      ordersRepository.updateStatus(attacker.id, order.id, 'atendido'),
    ).rejects.toThrow()

    const untouched = await prisma.order.findUnique({ where: { id: order.id } })
    expect(untouched?.status).toBe('pendente')
  })
})
