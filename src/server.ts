import 'dotenv/config'
import { buildApp } from './app'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import { closeBrowser } from './lib/pdf'

async function main() {
  const app = buildApp()

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'] as const
  for (const signal of signals) {
    process.on(signal, async () => {
      await app.close()
      await closeBrowser()
      await prisma.$disconnect()
      process.exit(0)
    })
  }

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    console.log(`🚀 Server running on port ${env.PORT}`)
  } catch (err) {
    app.log.error(err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
