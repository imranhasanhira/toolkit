import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.redditSettings.findFirst()
  console.dir(settings?.bottleneck, { depth: null })
  await prisma.$disconnect()
}

main().catch(console.error)
