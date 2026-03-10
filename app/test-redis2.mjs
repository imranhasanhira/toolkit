import Bottleneck from 'bottleneck';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.redditSettings.findMany();
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  
  const host = map['bottleneck.redis.host'];
  const clusteringEnabled = map['bottleneck.clustering.enabled'] === 'true' || map['bottleneck.clustering.enabled'] === true;
  
  console.log("Redis clustering enabled:", clusteringEnabled);
  console.log("Redis host:", host);
  
  if (clusteringEnabled && host) {
    console.log("Testing redis connection...");
    const connection = new Bottleneck.IORedisConnection({
      clientOptions: {
        host: host.trim(),
        port: Number(map['bottleneck.redis.port']) || 6379,
        connectTimeout: 2000
      },
    });
    
    connection.on('error', (err) => {
        console.error("IORedis Error:", err.message);
        process.exit(1);
    });
    connection.on('ready', () => { 
      console.log("IORedis Ready!"); 
      connection.disconnect(); 
      process.exit(0);
    });
  } else {
    console.log("Clustering disabled, using in-memory.");
  }
}

main().catch(console.error)
