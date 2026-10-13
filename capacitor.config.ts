import type { CapacitorConfig } from '@capacitor/cli';

if (!process.env.VITE_API_URL) {
  throw new Error('Set VITE_API_URL to the deployed API origin, for example https://your-project.vercel.app');
}

const config: CapacitorConfig = {
  appId: 'dev.instructorschedule.app',
  appName: 'Расписание',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
  },
};

export default config;
