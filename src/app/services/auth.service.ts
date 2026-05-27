import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { AuthSession, JellyfinUser } from '../models/auth.model';
import { AppConfigService } from './app-config.service';

type StorageMode = 'session' | 'local';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly configService = inject(AppConfigService);

  private readonly storageKey = 'orionplay.auth-session';
  private readonly storageModeKey = 'orionplay.auth-mode';
  private readonly sessionSignal = signal<AuthSession | null>(this.hydrateSession());

  readonly session = computed(() => this.sessionSignal());
  readonly user = computed(() => this.sessionSignal()?.User ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal()?.AccessToken));

  get token(): string {
    return this.sessionSignal()?.AccessToken ?? this.configService.config.apiKey ?? '';
  }

  get userId(): string {
    return this.sessionSignal()?.User.Id ?? '';
  }

  login(username: string, password: string, remember = false) {
    const url = `${this.configService.serverUrl}/Users/AuthenticateByName`;

    const headers = new HttpHeaders({
      Authorization: this.buildAuthHeader()
    });

    return this.http
      .post<AuthSession>(url, { Username: username, Pw: password }, { headers })
      .pipe(
        tap((session) => {
          this.sessionSignal.set(session);
          this.persistSession(session, remember ? 'local' : 'session');
        })
      );
  }

  logout() {
    this.clearPersistedSession();
    this.sessionSignal.set(null);
    void this.router.navigate(['/login']);
  }

  discoverPublicUsers() {
    if (!this.configService.serverUrl) {
      return of([] as JellyfinUser[]);
    }

    return this.http
      .get<JellyfinUser[]>(`${this.configService.serverUrl}/Users/Public`)
      .pipe(
        map((users) => [...users].sort((left, right) => left.Name.localeCompare(right.Name))),
        catchError(() => of([] as JellyfinUser[]))
      );
  }

  loginAsGuest(user: JellyfinUser, remember = false) {
    return this.login(user.Name, '', remember);
  }

  createAccount(username: string, password: string) {
    const url = `${this.configService.serverUrl}/Users/New`;

    return this.http.post<JellyfinUser>(url, { Name: username, Password: password }).pipe(
      switchMap((user) => this.publishUserToLoginScreen(user).pipe(map(() => user)))
    );
  }

  getAuthorizationHeader(): string {
    return this.buildAuthHeader(this.token);
  }

  profileImageUrl(user: JellyfinUser | null): string | null {
    if (!user?.Id || !user.PrimaryImageTag || !this.configService.serverUrl) {
      return null;
    }

    return `${this.configService.serverUrl}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}`;
  }

  private buildAuthHeader(token?: string): string {
    const { clientName, deviceName, deviceId, appVersion } = this.configService.config;
    const parts = [
      `Client="${clientName}"`,
      `Device="${deviceName}"`,
      `DeviceId="${deviceId}"`,
      `Version="${appVersion}"`
    ];

    if (token) {
      parts.push(`Token="${token}"`);
    }

    return `MediaBrowser ${parts.join(', ')}`;
  }

  private hydrateSession(): AuthSession | null {
    const sources: Storage[] = [globalThis.sessionStorage, globalThis.localStorage].filter(
      Boolean
    ) as Storage[];

    for (const source of sources) {
      const raw = source.getItem(this.storageKey);

      if (raw) {
        return JSON.parse(raw) as AuthSession;
      }
    }

    return null;
  }

  private persistSession(session: AuthSession, mode: StorageMode) {
    this.clearPersistedSession();
    const target = mode === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    target?.setItem(this.storageModeKey, mode);
    target?.setItem(this.storageKey, JSON.stringify(session));
  }

  private clearPersistedSession() {
    globalThis.localStorage?.removeItem(this.storageKey);
    globalThis.sessionStorage?.removeItem(this.storageKey);
    globalThis.localStorage?.removeItem(this.storageModeKey);
    globalThis.sessionStorage?.removeItem(this.storageModeKey);
  }

  private publishUserToLoginScreen(user: JellyfinUser) {
    if (!user?.Id || !this.configService.serverUrl) {
      return of(void 0);
    }

    return this.http.get<JellyfinUser>(`${this.configService.serverUrl}/Users/${user.Id}`).pipe(
      switchMap((fullUser) => {
        const policy = {
          ...(fullUser.Policy ?? {}),
          IsHidden: false,
          IsDisabled: false,
          EnableAllFolders: true,
          EnableMediaPlayback: true,
          EnableRemoteAccess: true
        };

        return this.http.post<void>(`${this.configService.serverUrl}/Users/${user.Id}/Policy`, policy);
      }),
      catchError(() => of(void 0))
    );
  }
}
