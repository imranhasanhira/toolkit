import Bottleneck from 'bottleneck';

async function run() {
  console.log("Starting test...");
  
  // Use a fake IP that will definitely blackhole TCP to test connectTimeout natively
  const limiter = new Bottleneck({
    id: 'test',
    connection: new Bottleneck.IORedisConnection({
      clientOptions: {
        host: '10.255.255.1', 
        port: 6379,
        connectTimeout: 2000,
        maxRetriesPerRequest: 3,
        retryStrategy: () => null
      }
    })
  });
  
  limiter.on('error', err => console.error("Global limiter error:", err.message));

  console.log("Queueing job...");
  const timer = setTimeout(() => console.log("--- 5 SECONDS PASSED, JOB STILL HANGING ---"), 5000);
  
  try {
    await limiter.schedule(() => {
      console.log("EXECUTING INSIDE LIMITER");
      return Promise.resolve();
    });
    console.log("Job completed successfully.");
  } catch (err) {
    console.error("Job rejected with error:", err.message);
  } finally {
    clearTimeout(timer);
    limiter.disconnect();
  }
}

run();
