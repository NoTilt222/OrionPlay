export interface TmdbConfig {
  apiBaseUrl: string;
  imageBaseUrl: string;
  apiReadToken?: string;
  language: string;
  region: string;
}

export interface AppConfig {
  serverUrl: string;
  apiKey?: string;
  clientName: string;
  deviceName: string;
  deviceId: string;
  appVersion: string;
  tmdb: TmdbConfig;
}
