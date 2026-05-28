import { config as loadEnv } from 'dotenv';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

loadEnv({ path: resolve('.env') });
loadEnv({ path: resolve('.env.local'), override: true });

const targetPath = resolve('src/assets/app-config.json');
const templatePath = resolve('src/assets/app-config.template.json');

const template = JSON.parse(readFileSync(templatePath, 'utf8'));
const runtimeConfig = {
  ...template,
  serverUrl: (process.env.JELLYFIN_SERVER_URL ?? template.serverUrl ?? '').replace(/\/+$/, ''),
  apiKey: process.env.JELLYFIN_API_KEY ?? template.apiKey ?? '',
  clientName: process.env.JELLYFIN_CLIENT_NAME ?? template.clientName ?? 'OrionPlay',
  deviceName: process.env.JELLYFIN_DEVICE_NAME ?? template.deviceName ?? 'Browser',
  deviceId: process.env.JELLYFIN_DEVICE_ID ?? template.deviceId ?? '',
  appVersion: process.env.JELLYFIN_APP_VERSION ?? template.appVersion ?? '0.1.0',
  tmdb: {
    ...template.tmdb,
    apiBaseUrl: (process.env.TMDB_API_BASE_URL ?? template.tmdb?.apiBaseUrl ?? 'https://api.themoviedb.org/3').replace(/\/+$/, ''),
    imageBaseUrl: (process.env.TMDB_IMAGE_BASE_URL ?? template.tmdb?.imageBaseUrl ?? 'https://image.tmdb.org/t/p').replace(/\/+$/, ''),
    apiReadToken: process.env.TMDB_API_READ_TOKEN ?? template.tmdb?.apiReadToken ?? '',
    language: process.env.TMDB_LANGUAGE ?? template.tmdb?.language ?? 'en-US',
    region: process.env.TMDB_REGION ?? template.tmdb?.region ?? 'US'
  }
};

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, 'utf8');
