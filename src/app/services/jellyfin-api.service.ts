import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';

@Injectable({ providedIn: 'root' })
export class JellyfinApiService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(AppConfigService);

  /**
   * The Angular frontend talks to Jellyfin through the same REST endpoints
   * the native apps use:
   * - `/Users/AuthenticateByName` for login
   * - `/Users/{userId}/Items` for libraries, rows, and details
   * - `/Users/{userId}/Items/Resume` for continue watching
   * - `/Videos/{itemId}/master.m3u8` for HLS playback
   */
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Observable<T> {
    return this.http.get<T>(this.buildUrl(path), { params: this.toParams(params) });
  }

  post<T>(
    path: string,
    body: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body, { params: this.toParams(params) });
  }

  delete<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Observable<T> {
    return this.http.delete<T>(this.buildUrl(path), { params: this.toParams(params) });
  }

  imageUrl(
    itemId: string,
    type: 'Primary' | 'Backdrop' | 'Thumb',
    tag?: string,
    maxWidth = 1280
  ): string {
    const url = new URL(
      `/Items/${itemId}/Images/${type}`,
      `${this.configService.serverUrl || 'http://placeholder.invalid'}`
    );

    url.searchParams.set('quality', '90');
    url.searchParams.set('maxWidth', `${maxWidth}`);

    if (tag) {
      url.searchParams.set('tag', tag);
    }

    return url.toString().replace('http://placeholder.invalid', '');
  }

  buildPublicUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, `${this.configService.serverUrl || 'http://placeholder.invalid'}/`);
    const httpParams = this.toParams(params);

    for (const key of httpParams.keys()) {
      const value = httpParams.get(key);

      if (value !== null) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString().replace('http://placeholder.invalid', '');
  }

  private buildUrl(path: string): string {
    const base = this.configService.serverUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  private toParams(params?: Record<string, string | number | boolean | undefined>): HttpParams {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, `${value}`);
      }
    }

    return httpParams;
  }
}
