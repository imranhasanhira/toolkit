import Bottleneck from 'bottleneck';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.redditSettings.findFirst()
  const b = settings.bottleneck;
  
  console.log("Redis clustering enabled:", b.redis?.clusteringEnabled);
  console.log("Redis host:", b.redis?.host);
  
  if (b.redis?.clusteringEnabled && b.redis?.host) {
    console.log("Testing redis connection...");
    
    // Create direct connection to test if it hangs
    const connection = new Bottleneck.IORedisConnection({
      clientOptions: {
        host: b.redis.host.trim(),
        port: b.redis.port ?? 6379,
        maxRetriesPerRequest: 3,
        // Drop timeout to 2 seconds so we don't hang script
        connectTimeout: 2000
      },
    });
    
    connection.on('error', (err) => console.error("IORedis Error:", err));
    connection.on('ready', () => { 
      console.log("IORedis Ready!"); 
      connection.disconnect(); 
    });
  } else {
    console.log("Clustering disabled, using in-memory.");
  }
}

main().catch(console.error)
