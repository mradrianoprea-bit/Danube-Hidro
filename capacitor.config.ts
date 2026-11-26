import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ro.hidrodunare.app',
  appName: 'HidroDunare',
  webDir: 'dist',
  server: {
    // Pentru conectarea la backend-ul Express live din producție în APK / IPA,
    // setați URL-ul HTTPS al serverului (ex. Cloud Run) în variabila CAPACITOR_SERVER_URL.
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#0369A1',
    },
  },
};

export default config;
