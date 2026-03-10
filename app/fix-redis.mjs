import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.redditSettings.findFirst({
    where: { key: 'bottleneck.clustering.enabled' }
  });
  
  if (settings && settings.value === 'true') {
     console.log("Fixing production setting...");
     await prisma.redditSettings.update({
       where: { key: 'bottleneck.clustering.enabled' },
       data: { value: 'false' }
     });
     console.log("Successfully disabled Reddit Bottleneck Redis clustering.");
  } else {
     console.log("Redis clustering is already disabled.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
