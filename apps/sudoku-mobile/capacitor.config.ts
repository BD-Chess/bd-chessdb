import type { CapacitorConfig } from '@capacitor/cli';

// Proposed identifier: review against BD's final developer account before distribution.
const config: CapacitorConfig = {
  appId: 'org.chessbest.eightzsudoku',
  appName: '8zSudoku',
  webDir: 'web',
  server: { androidScheme: 'https' },
};
export default config;
