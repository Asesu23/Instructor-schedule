import type { CapacitorConfig } from '@capacitor/cli';

const url = process.env.APP_URL;

if (!url) throw new Error('Set APP_URL to the deployed app URL, for example https://your-project.vercel.app');

const config: CapacitorConfig = {
  appId: 'dev.instructorschedule.app',
  appName: 'Расписание',
  webDir: 'dist',
  server: { url },
};

export default config;
