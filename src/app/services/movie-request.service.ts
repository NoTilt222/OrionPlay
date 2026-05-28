import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, catchError, map, tap, throwError } from 'rxjs';
import { MediaItem } from '../models/media.model';
import { MovieRequestApiResponse, MovieRequestPayload } from '../models/movie-request.model';
import { AuthService } from './auth.service';
import { MediaService } from './media.service';

@Injectable({ providedIn: 'root' })
export class MovieRequestService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly media = inject(MediaService);

  private readonly storageKey = 'orionplay.movie-requests';
  private readonly sessionIdKey = 'orionplay.movie-request-session';
  private readonly requestedKeysSubject = new BehaviorSubject<string[]>(this.readRequestedKeys());

  readonly requestedKeys$ = this.requestedKeysSubject.asObservable();

  canRequest(item: MediaItem): boolean {
    return !this.media.isPlayable(item) && item.Type === 'Movie' && item.TmdbMediaType !== 'tv' && Boolean(item.TmdbId);
  }

  isRequested(item: MediaItem): boolean {
    return Boolean(item.TmdbId) && this.requestedKeysSubject.value.includes(this.requestStateKey(item.TmdbId!));
  }

  requestMovie(item: MediaItem, pageUrl: string) {
    if (!item.TmdbId) {
      return throwError(() => new Error('This movie is missing its TMDB id, so it cannot be requested yet.'));
    }

    const payload: MovieRequestPayload & { requestKey: string } = {
      title: item.Name.trim(),
      tmdbId: item.TmdbId,
      releaseYear: item.ProductionYear,
      posterUrl: this.media.posterUrl(item, 780) ?? undefined,
      backdropUrl: this.media.backdropUrl(item, 1600) ?? undefined,
      overview: item.Overview?.trim() || undefined,
      userName: this.auth.requesterName || undefined,
      userEmail: this.auth.requesterEmail || undefined,
      pageUrl: pageUrl.trim() || undefined,
      requestKey: this.requestTransportKey(item.TmdbId)
    };

    // Keep the Resend key on the server by posting to a same-origin Vercel function.
    return this.http.post<MovieRequestApiResponse>('/api/request-movie', payload).pipe(
      tap((response) => {
        if (!response.ok) {
          throw new Error(response.message);
        }

        this.markRequested(item.TmdbId!);
      }),
      map((response) => response),
      catchError((error) =>
        throwError(() => new Error(this.resolveErrorMessage(error)))
      )
    );
  }

  private requestStateKey(tmdbId: number): string {
    return `${this.auth.userId || 'guest'}:${tmdbId}`;
  }

  private requestTransportKey(tmdbId: number): string {
    return `${this.sessionId()}:${this.requestStateKey(tmdbId)}`;
  }

  private markRequested(tmdbId: number) {
    const requestKey = this.requestStateKey(tmdbId);

    if (this.requestedKeysSubject.value.includes(requestKey)) {
      return;
    }

    const nextKeys = [requestKey, ...this.requestedKeysSubject.value];
    this.requestedKeysSubject.next(nextKeys);
    globalThis.sessionStorage?.setItem(this.storageKey, JSON.stringify(nextKeys));
  }

  private readRequestedKeys(): string[] {
    try {
      const raw = globalThis.sessionStorage?.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private sessionId(): string {
    const existing = globalThis.sessionStorage?.getItem(this.sessionIdKey);

    if (existing) {
      return existing;
    }

    const next = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    globalThis.sessionStorage?.setItem(this.sessionIdKey, next);
    return next;
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        typeof error.error?.message === 'string'
          ? error.error.message
          : '';

      if (apiMessage) {
        return apiMessage;
      }

      if (error.status === 0 || error.status === 404) {
        return 'The local movie request API is not running. Start OrionPlay with npm run frontend.';
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    const message =
      typeof error === 'object' &&
      error &&
      'error' in error &&
      typeof (error as { error?: { message?: string } }).error?.message === 'string'
        ? (error as { error: { message: string } }).error.message
        : '';

    return message || 'We could not send your movie request right now.';
  }
}
