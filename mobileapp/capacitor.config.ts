import type { CapacitorConfig } from '@capacitor/cli';

// Hosted mode:
// - Set CAP_SERVER_URL to your deployed Wasp frontend URL (recommended: https).
// - For Android emulator local dev, you can use http://10.0.2.2:<port>.
const serverUrl =
  process.env.CAP_SERVER_URL || 'https://toolkit.naurinjahan.com/carely';
const hostname = (() => {
  try { return new URL(serverUrl).hostname; } catch { return undefined; }
})();

const config: CapacitorConfig = {
  appId: 'com.diaorg.apps.toolkit.carely',
  appName: 'Carely',
  // Kept as a fallback if server.url is removed.
  webDir: 'app/.wasp/build/web-app/build',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    ...(hostname ? { allowNavigation: [hostname] } : {}),
  },
  plugins: {
    SplashScreen: {
      // Avoid getting stuck on splash if the web app doesn't manually hide it.
      launchAutoHide: true,
    },
  },
};

export default config;

