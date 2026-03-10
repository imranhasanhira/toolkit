const AbortController = globalThis.AbortController;

async function run() {
  console.log('Starting fetch test...');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('Aborting!');
    controller.abort();
  }, 2000);

  try {
    const res = await fetch('https://www.reddit.com/r/all/new.json?limit=100', {
      headers: { 'User-Agent': 'server:toolkit-leadgen:1.0 (by /u/toolkit-user)' },
      signal: controller.signal
    });
    console.log('Status:', res.status);
    clearTimeout(timeoutId);
  } catch (err) {
    console.error('Caught error:', err.message);
  }
}

run();
