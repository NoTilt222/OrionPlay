import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { AuthSession, JellyfinUser, OrionPlaySessionMeta } from '../models/auth.model';
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
  readonly isGuest = computed(() => Boolean(this.sessionSignal()?.OrionPlay?.IsGuest));

  get token(): string {
    return this.sessionSignal()?.AccessToken ?? this.configService.config.apiKey ?? '';
  }

  get userId(): string {
    return this.sessionSignal()?.User.Id ?? '';
  }

  get requesterName(): string {
    return this.sessionSignal()?.User.Name ?? '';
  }

  get requesterEmail(): string {
    const identifier = this.sessionSignal()?.OrionPlay?.LoginIdentifier?.trim() ?? '';
    return this.looksLikeEmail(identifier) ? identifier : '';
  }

  login(username: string, password: string, remember = false, meta: OrionPlaySessionMeta = {}) {
    const url = `${this.configService.serverUrl}/Users/AuthenticateByName`;

    const headers = new HttpHeaders({
      Authorization: this.buildAuthHeader()
    });

    return this.http
      .post<AuthSession>(url, { Username: username, Pw: password }, { headers })
      .pipe(
        tap((session) => {
          const decoratedSession = this.decorateSession(session, {
            IsGuest: false,
            LoginIdentifier: username.trim(),
            ...meta
          });

          this.sessionSignal.set(decoratedSession);
          this.persistSession(decoratedSession, remember ? 'local' : 'session');
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
        switchMap((users) => {
          const passwordFiltered = this.filterGuestCapableUsers(users);

          if (passwordFiltered.length !== users.length || !this.configService.config.apiKey?.trim()) {
            return of(passwordFiltered);
          }

          return this.http.get<JellyfinUser[]>(`${this.configService.serverUrl}/Users`).pipe(
            map((allUsers) => {
              const detailsById = new Map(allUsers.map((user) => [user.Id, user]));

              return users.filter((user) => {
                const details = detailsById.get(user.Id);
                return !this.hasPassword(details ?? user);
              });
            }),
            catchError(() => of(passwordFiltered))
          );
        }),
        map((users) => [...users].sort((left, right) => left.Name.localeCompare(right.Name))),
        catchError(() => of([] as JellyfinUser[]))
      );
  }

  loginAsGuest(user: JellyfinUser, remember = false) {
    return this.login(user.Name, '', remember, {
      IsGuest: true,
      LoginIdentifier: user.Name
    });
  }

  createAccount(username: string, password: string) {
    const url = `${this.configService.serverUrl}/Users/New`;

    return this.http.post<JellyfinUser>(url, { Name: username, Password: password }).pipe(
      switchMap((user) => this.hideUserFromLoginScreen(user).pipe(map(() => user)))
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

  private decorateSession(session: AuthSession, meta: OrionPlaySessionMeta): AuthSession {
    return {
      ...session,
      OrionPlay: {
        ...(session.OrionPlay ?? {}),
        ...meta
      }
    };
  }

  private looksLikeEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private filterGuestCapableUsers(users: JellyfinUser[]): JellyfinUser[] {
    return users.filter((user) => !this.hasPassword(user));
  }

  private hasPassword(user: JellyfinUser | null | undefined): boolean {
    return Boolean(user?.HasPassword || user?.HasConfiguredPassword);
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

  private hideUserFromLoginScreen(user: JellyfinUser) {
    if (!user?.Id || !this.configService.serverUrl) {
      return of(void 0);
    }

    return this.http.get<JellyfinUser>(`${this.configService.serverUrl}/Users/${user.Id}`).pipe(
      switchMap((fullUser) => {
        const policy = {
          ...(fullUser.Policy ?? {}),
          IsHidden: true
        };

        return this.http.post<void>(`${this.configService.serverUrl}/Users/${user.Id}/Policy`, policy);
      }),
      catchError(() => of(void 0))
    );
  }
}
