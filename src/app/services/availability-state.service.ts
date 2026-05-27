import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MediaItem } from '../models/media.model';

@Injectable({ providedIn: 'root' })
export class AvailabilityStateService {
  private readonly watchlistKey = 'orionplay.watchlist';
  private readonly requestKey = 'orionplay.requests';

  private readonly watchlistSubject = new BehaviorSubject<string[]>(this.readIds(this.watchlistKey));
  private readonly requestSubject = new BehaviorSubject<string[]>(this.readIds(this.requestKey));

  readonly watchlistIds$ = this.watchlistSubject.asObservable();
  readonly requestedIds$ = this.requestSubject.asObservable();

  isInWatchlist(itemOrId: MediaItem | string): boolean {
    return this.watchlistSubject.value.includes(this.resolveId(itemOrId));
  }

  isRequested(itemOrId: MediaItem | string): boolean {
    return this.requestSubject.value.includes(this.resolveId(itemOrId));
  }

  toggleWatchlist(item: MediaItem): void {
    const itemId = this.resolveId(item);
    const nextIds = this.watchlistSubject.value.includes(itemId)
      ? this.watchlistSubject.value.filter((id) => id !== itemId)
      : [itemId, ...this.watchlistSubject.value];

    this.persist(this.watchlistKey, this.watchlistSubject, nextIds);
  }

  requestTitle(item: MediaItem): void {
    const itemId = this.resolveId(item);

    if (this.requestSubject.value.includes(itemId)) {
      return;
    }

    this.persist(this.requestKey, this.requestSubject, [itemId, ...this.requestSubject.value]);
  }

  private resolveId(itemOrId: MediaItem | string): string {
    return typeof itemOrId === 'string' ? itemOrId : itemOrId.Id;
  }

  private persist(key: string, subject: BehaviorSubject<string[]>, value: string[]) {
    subject.next(value);
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  }

  private readIds(key: string): string[] {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
}
