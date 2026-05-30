import { Injectable, inject } from '@angular/core';
import { map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { MediaCollectionResponse, MediaItem } from '../models/media.model';
import { JellyfinApiService } from './jellyfin-api.service';

interface JellyfinLibraryIndex {
  items: MediaItem[];
  byTmdbId: Map<number, MediaItem[]>;
  byTitle: Map<string, MediaItem[]>;
  byTitleYear: Map<string, MediaItem[]>;
}

const LIBRARY_FIELDS = [
  'Overview',
  'Genres',
  'UserData',
  'MediaSources',
  'MediaStreams',
  'RunTimeTicks',
  'Tags',
  'OfficialRating',
  'ProductionYear',
  'PremiereDate',
  'CommunityRating',
  'ProviderIds',
  'ParentBackdropItemId',
  'BackdropImageTags',
  'ImageTags'
].join(',');

@Injectable({ providedIn: 'root' })
export class JellyfinLibraryService {
  private readonly api = inject(JellyfinApiService);
  private readonly indexCache = new Map<string, Observable<JellyfinLibraryIndex>>();

  getLibraryIndex(userId: string): Observable<JellyfinLibraryIndex> {
    if (!userId) {
      return of(this.emptyIndex());
    }

    const cached = this.indexCache.get(userId);

    if (cached) {
      return cached;
    }

    const request$ = this.fetchLibraryPage(userId).pipe(
      map((items) => this.buildIndex(items)),
      shareReplay(1)
    );

    this.indexCache.set(userId, request$);
    return request$;
  }

  getItemDetails(userId: string, libraryItemId: string): Observable<MediaItem> {
    return this.api
      .get<MediaItem>(`/Users/${userId}/Items/${libraryItemId}`, {
        Fields: LIBRARY_FIELDS
      })
      .pipe(map((item) => this.normalizeLocalItem(item)));
  }

  matchCatalogItems(userId: string, items: MediaItem[]): Observable<MediaItem[]> {
    if (!items.length) {
      return of([]);
    }

    return this.getLibraryIndex(userId).pipe(map((index) => items.map((item) => this.matchItem(item, index))));
  }

  normalizeLocalItem(item: MediaItem): MediaItem {
    const libraryItemId = item.LibraryItemId ?? item.Id;
    const tmdbId = item.TmdbId ?? this.tmdbProviderId(item.ProviderIds);
    const tmdbMediaType = item.TmdbMediaType ?? this.tmdbMediaTypeForItem(item);

    return {
      ...item,
      Id: tmdbId ? this.tmdbRouteId(tmdbMediaType, tmdbId) : this.jellyfinRouteId(libraryItemId),
      TmdbId: tmdbId,
      TmdbMediaType: tmdbId ? tmdbMediaType : item.TmdbMediaType,
      LibraryItemId: libraryItemId,
      Available: true,
      Source: tmdbId ? 'hybrid' : 'jellyfin'
    };
  }

  mergeCatalogWithLibrary(catalogItem: MediaItem, libraryItem: MediaItem): MediaItem {
    const normalizedLocal = this.normalizeLocalItem(libraryItem);

    return {
      ...normalizedLocal,
      ...catalogItem,
      Id: catalogItem.Id,
      LibraryItemId: normalizedLocal.LibraryItemId,
      Available: true,
      Source: 'hybrid',
      UserData: normalizedLocal.UserData,
      MediaSources: normalizedLocal.MediaSources,
      MediaStreams: normalizedLocal.MediaStreams,
      ImageTags: normalizedLocal.ImageTags,
      BackdropImageTags: normalizedLocal.BackdropImageTags,
      ParentBackdropItemId: normalizedLocal.ParentBackdropItemId,
      ProviderIds: {
        ...(normalizedLocal.ProviderIds ?? {}),
        ...(catalogItem.ProviderIds ?? {})
      }
    };
  }

  tmdbProviderId(providerIds?: Record<string, string>): number | undefined {
    if (!providerIds) {
      return undefined;
    }

    for (const [key, value] of Object.entries(providerIds)) {
      if (!value || !key.toLowerCase().includes('tmdb')) {
        continue;
      }

      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  jellyfinRouteId(itemId: string): string {
    return `jf-${itemId}`;
  }

  tmdbRouteId(mediaType: 'movie' | 'tv', tmdbId: number): string {
    return `tmdb-${mediaType}-${tmdbId}`;
  }

  private fetchLibraryPage(userId: string, startIndex = 0, items: MediaItem[] = []): Observable<MediaItem[]> {
    return this.api
      .get<MediaCollectionResponse>(`/Users/${userId}/Items`, {
        Fields: LIBRARY_FIELDS,
        ImageTypeLimit: 1,
        IncludeItemTypes: 'Movie,Series',
        Limit: 200,
        Recursive: true,
        SortBy: 'SortName',
        StartIndex: startIndex
      })
      .pipe(
        switchMap((response) => {
          const nextItems = [...items, ...(response.Items ?? [])];

          if (nextItems.length >= (response.TotalRecordCount ?? 0) || !(response.Items?.length)) {
            return of(nextItems.map((item) => this.normalizeLocalItem(item)));
          }

          return this.fetchLibraryPage(userId, startIndex + (response.Items?.length ?? 0), nextItems);
        })
      );
  }

  private buildIndex(items: MediaItem[]): JellyfinLibraryIndex {
    const byTmdbId = new Map<number, MediaItem[]>();
    const byTitle = new Map<string, MediaItem[]>();
    const byTitleYear = new Map<string, MediaItem[]>();

    for (const item of items) {
      const tmdbId = item.TmdbId ?? this.tmdbProviderId(item.ProviderIds);

      if (tmdbId) {
        const matches = byTmdbId.get(tmdbId) ?? [];
        matches.push(item);
        byTmdbId.set(tmdbId, matches);
      }

      const normalizedTitle = this.normalizeTitle(item.Name);
      const year = this.releaseYear(item);

      this.pushMapValue(byTitle, normalizedTitle, item);

      if (year) {
        this.pushMapValue(byTitleYear, `${normalizedTitle}:${year}`, item);
      }
    }

    return {
      items,
      byTmdbId,
      byTitle,
      byTitleYear
    };
  }

  private matchItem(item: MediaItem, index: JellyfinLibraryIndex): MediaItem {
    const match = this.findMatch(item, index);

    if (!match) {
      return {
        ...item,
        Available: false,
        Source: 'tmdb'
      };
    }

    return this.mergeCatalogWithLibrary(item, match);
  }

  private findMatch(item: MediaItem, index: JellyfinLibraryIndex): MediaItem | undefined {
    if (item.TmdbId) {
      const byTmdbId = index.byTmdbId.get(item.TmdbId)?.find((candidate) => this.sameKind(candidate, item));

      if (byTmdbId) {
        return byTmdbId;
      }
    }

    const normalizedTitle = this.normalizeTitle(item.Name);
    const releaseYear = this.releaseYear(item);

    if (releaseYear) {
      const exact = index.byTitleYear
        .get(`${normalizedTitle}:${releaseYear}`)
        ?.find((candidate) => this.sameKind(candidate, item));

      if (exact) {
        return exact;
      }
    }

    return index.byTitle.get(normalizedTitle)?.find((candidate) => this.sameKind(candidate, item));
  }

  private sameKind(left: MediaItem, right: MediaItem): boolean {
    return this.tmdbMediaTypeForItem(left) === this.tmdbMediaTypeForItem(right);
  }

  private tmdbMediaTypeForItem(item: MediaItem): 'movie' | 'tv' {
    return item.Type === 'Series' ? 'tv' : 'movie';
  }

  private normalizeTitle(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private releaseYear(item: MediaItem): number | null {
    return item.ProductionYear ?? (item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : null);
  }

  private pushMapValue(mapRef: Map<string, MediaItem[]>, key: string, item: MediaItem) {
    if (!key) {
      return;
    }

    const items = mapRef.get(key) ?? [];
    items.push(item);
    mapRef.set(key, items);
  }

  private emptyIndex(): JellyfinLibraryIndex {
    return {
      items: [],
      byTmdbId: new Map<number, MediaItem[]>(),
      byTitle: new Map<string, MediaItem[]>(),
      byTitleYear: new Map<string, MediaItem[]>()
    };
  }
}
