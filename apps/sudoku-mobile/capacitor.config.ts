import type { CapacitorConfig } from '@capacitor/cli';

// Registered identity used by the existing installed TestFlight app; preserve it.
const config: CapacitorConfig = {
  appId: 'org.chessbest.eightzsudoku',
  appName: '8zSudoku',
  webDir: 'web',
  server: { androidScheme: 'https' },
};
export default config;
