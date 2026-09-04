import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kardexis.app',
  appName: 'Kardexis',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Backend URL - cambiar esta IP por la de la PC donde corre el backend
    // En desarrollo: http://192.168.x.x:8000
    // En produccion: https://dominio-del-backend.com
    url: 'http://192.168.1.100:8000',
    cleartext: true,
  },
};

export default config;
