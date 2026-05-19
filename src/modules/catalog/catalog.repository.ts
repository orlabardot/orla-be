import { prisma } from '../../lib/prisma'

// --- CATEGORIES ---

export const categoriesRepository = {
  async findAll(tenantId: string) {
    return prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
  },

  async findById(tenantId: string, id: string) {
    return prisma.category.findFirst({
      where: { id, tenantId },
    })
  },

  async findBySlug(tenantId: string, slug: string) {
    return prisma.category.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    })
  },

  async create(data: { tenantId: string; name: string; slug: string }) {
    return prisma.category.create({ data })
  },

  async update(id: string, data: { name: string; slug: string }) {
    return prisma.category.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.category.delete({ where: { id } })
  },
}

// --- BRANDS ---

export const brandsRepository = {
  async findAll(tenantId: string) {
    return prisma.brand.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
  },

  async findById(tenantId: string, id: string) {
    return prisma.brand.findFirst({
      where: { id, tenantId },
    })
  },

  async findBySlug(tenantId: string, slug: string) {
    return prisma.brand.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    })
  },

  async create(data: { tenantId: string; name: string; slug: string }) {
    return prisma.brand.create({ data })
  },

  async update(id: string, data: { name: string; slug: string }) {
    return prisma.brand.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.brand.delete({ where: { id } })
  },
}

// --- TAGS ---

export const tagsRepository = {
  async findAll(tenantId: string) {
    return prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
  },

  async findById(tenantId: string, id: string) {
    return prisma.tag.findFirst({
      where: { id, tenantId },
    })
  },

  async findBySlug(tenantId: string, slug: string) {
    return prisma.tag.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    })
  },

  async create(data: { tenantId: string; name: string; slug: string }) {
    return prisma.tag.create({ data })
  },

  async update(id: string, data: { name: string; slug: string }) {
    return prisma.tag.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.tag.delete({ where: { id } })
  },
}
