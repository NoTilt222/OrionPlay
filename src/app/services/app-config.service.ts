import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppConfig } from '../models/app-config.model';

const DEFAULT_CONFIG: AppConfig = {
  serverUrl: '',
  apiKey: '',
  clientName: 'OrionPlay',
  deviceName: 'Browser',
  deviceId: '',
  appVersion: '0.1.0',
  tmdb: {
    apiBaseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
    apiReadToken: '',
    language: 'en-US',
    region: 'US'
  }
};

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly configSubject = new BehaviorSubject<AppConfig>(DEFAULT_CONFIG);

  readonly config$ = this.configSubject.asObservable();

  get config(): AppConfig {
    return this.configSubject.value;
  }

  async loadConfig(): Promise<void> {
    try {
      const response = await fetch('/assets/app-config.json', { cache: 'no-store' });
      const loaded = (await response.json()) as Partial<AppConfig>;
      this.configSubject.next(this.normalizeConfig(loaded));
    } catch {
      this.configSubject.next(this.normalizeConfig(DEFAULT_CONFIG));
    }
  }

  get serverUrl(): string {
    return this.config.serverUrl;
  }

  get tmdb() {
    return this.config.tmdb;
  }

  private normalizeConfig(partial: Partial<AppConfig>): AppConfig {
    const storedDeviceId = globalThis.localStorage?.getItem('orionplay.device-id') ?? '';
    const deviceId = partial.deviceId?.trim() || storedDeviceId || crypto.randomUUID();
    const partialTmdb = (partial.tmdb ?? {}) as Partial<AppConfig['tmdb']>;

    globalThis.localStorage?.setItem('orionplay.device-id', deviceId);

    return {
      serverUrl: partial.serverUrl?.replace(/\/+$/, '') ?? '',
      apiKey: partial.apiKey ?? '',
      clientName: partial.clientName || 'OrionPlay',
      deviceName: partial.deviceName || 'Browser',
      deviceId,
      appVersion: partial.appVersion || '0.1.0',
      tmdb: {
        apiBaseUrl: partialTmdb.apiBaseUrl?.replace(/\/+$/, '') || 'https://api.themoviedb.org/3',
        imageBaseUrl: partialTmdb.imageBaseUrl?.replace(/\/+$/, '') || 'https://image.tmdb.org/t/p',
        apiReadToken: partialTmdb.apiReadToken ?? '',
        language: partialTmdb.language || 'en-US',
        region: partialTmdb.region || 'US'
      }
    };
  }
}
