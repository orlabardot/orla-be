import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Criar tenant padrão
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Ótica',
      slug: 'demo',
    },
  })

  console.log(`✅ Tenant: ${tenant.name} (${tenant.slug})`)

  // Criar usuário admin
  const passwordHash = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Admin',
      email: 'admin@demo.com',
      passwordHash,
      role: 'admin',
    },
  })

  console.log(`✅ Admin: ${admin.email}`)

  // Criar categorias
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'armacoes' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Armações', slug: 'armacoes' },
    }),
    prisma.category.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'solares' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Solares', slug: 'solares' },
    }),
  ])

  console.log(`✅ Categories: ${categories.map((c) => c.name).join(', ')}`)

  // Criar marcas
  const brands = await Promise.all([
    prisma.brand.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'oakley' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Oakley', slug: 'oakley' },
    }),
    prisma.brand.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'ray-ban' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Ray-Ban', slug: 'ray-ban' },
    }),
  ])

  console.log(`✅ Brands: ${brands.map((b) => b.name).join(', ')}`)

  console.log('\n🎉 Seed completed!')
  console.log('   Login: admin@demo.com / admin123')
  console.log('   Tenant slug: demo')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
