import { Injectable, inject } from '@angular/core';
import { catchError, combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { GenreItem, MediaCollectionResponse, MediaItem } from '../models/media.model';
import { MOCK_HOME_CATALOG, MOCK_ITEM_LOOKUP } from '../shared/mock-catalog';
import { AvailabilityStateService } from './availability-state.service';
import { JellyfinApiService } from './jellyfin-api.service';
import { JellyfinLibraryService } from './jellyfin-library.service';
import { TmdbApiService } from './tmdb-api.service';

export interface HomeSections {
  heroItems: MediaItem[];
  spotlightPicks: MediaItem[];
  continueWatching: MediaItem[];
  trendingNow: MediaItem[];
  popularMovies: MediaItem[];
  newReleases: MediaItem[];
  recommendedForYou: MediaItem[];
  actionMovies: MediaItem[];
  sciFi: MediaItem[];
  tvShows: MediaItem[];
  genres: GenreItem[];
}

const ACTION_GENRE_ID = '28';
const SCI_FI_GENRE_ID = '878';
const LOCAL_ITEM_FIELDS = [
  'Overview',
  'Genres',
  'UserData',
  'MediaSources',
  'MediaStreams',
  'RunTimeTicks',
  'CommunityRating',
  'OfficialRating',
  'ProductionYear',
  'PremiereDate',
  'Tags',
  'ProviderIds',
  'ParentBackdropItemId',
  'BackdropImageTags',
  'ImageTags'
].join(',');

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly api = inject(JellyfinApiService);
  private readonly tmdb = inject(TmdbApiService);
  private readonly library = inject(JellyfinLibraryService);
  private readonly availabilityState = inject(AvailabilityStateService);

  getHomeSections(userId: string): Observable<HomeSections> {
    const source$ = this.tmdb.isConfigured() ? this.getTmdbHomeSections(userId) : this.getLocalHomeSections(userId);
    return source$.pipe(catchError(() => of(this.enrichWithMockCatalog(MOCK_HOME_CATALOG))));
  }

  getTrendingMovies(userId: string): Observable<MediaItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalTrendingMovies(userId);
    }

    return this.matchCatalogSource(userId, this.tmdb.getTrending(18), MOCK_HOME_CATALOG.trendingNow, 18);
  }

  getRecentlyAdded(userId: string): Observable<MediaItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalRecentlyAdded(userId);
    }

    return this.matchCatalogSource(userId, this.tmdb.getNewReleases(18), MOCK_HOME_CATALOG.newReleases, 18);
  }

  getContinueWatching(userId: string): Observable<MediaItem[]> {
    return this.api
      .get<MediaCollectionResponse>(`/Users/${userId}/Items/Resume`, {
        Fields: LOCAL_ITEM_FIELDS,
        Limit: 15,
        MediaTypes: 'Video'
      })
      .pipe(
        map((response) => (response.Items ?? []).map((item) => this.library.normalizeLocalItem(item))),
        catchError(() => of(MOCK_HOME_CATALOG.continueWatching))
      );
  }

  getMovies(userId: string, genre?: string): Observable<MediaItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalMovies(userId, genre);
    }

    const source$ = genre
      ? this.tmdb.getMoviesByGenre(genre, 36)
      : combineLatest([
          this.tmdb.getPopularMovies(20),
          this.tmdb.getTopRatedMovies(20),
          this.tmdb.getNewReleases(20)
        ]).pipe(map(([popular, topRated, newReleases]) => this.pickDistinct([...popular, ...topRated, ...newReleases], 36)));

    return this.matchCatalogSource(userId, source$, genre ? MOCK_HOME_CATALOG.actionMovies : MOCK_HOME_CATALOG.popularMovies, 36);
  }

  getSeries(userId: string, genre?: string): Observable<MediaItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalSeries(userId, genre);
    }

    return this.matchCatalogSource(userId, this.tmdb.getTvShows(36, genre), MOCK_HOME_CATALOG.tvShows, 36);
  }

  getFavorites(userId: string): Observable<MediaItem[]> {
    const localFavorites$ = this.getLocalFavorites(userId);
    const watchlist$ = this.availabilityState.watchlistIds$.pipe(
      switchMap((ids) =>
        ids.length
          ? combineLatest(ids.map((id) => this.getDetails(userId, id).pipe(catchError(() => of(this.missingItem(id))))))
          : of([] as MediaItem[])
      )
    );

    return combineLatest([localFavorites$, watchlist$]).pipe(
      map(([localFavorites, watchlistItems]) => this.pickDistinct([...watchlistItems, ...localFavorites], 60))
    );
  }

  getGenres(_userId: string): Observable<GenreItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalGenres(_userId);
    }

    return this.tmdb.getGenres().pipe(
      map((genres) => genres.slice(0, 18)),
      catchError(() => of(MOCK_HOME_CATALOG.genres))
    );
  }

  getDetails(userId: string, itemId: string): Observable<MediaItem> {
    if (MOCK_ITEM_LOOKUP.has(itemId)) {
      return of(MOCK_ITEM_LOOKUP.get(itemId)!);
    }

    const parsed = this.parseRouteId(itemId);

    if (parsed.kind === 'tmdb' && this.tmdb.isConfigured()) {
      return this.tmdb.getDetails(parsed.mediaType, parsed.tmdbId).pipe(
        switchMap((item) => (item ? this.library.matchCatalogItems(userId, [item]) : of([]))),
        map((items) => items[0] ?? this.missingItem(itemId)),
        catchError(() => of(this.missingItem(itemId)))
      );
    }

    const libraryItemId = parsed.kind === 'jellyfin' ? parsed.libraryItemId : itemId;

    return this.library.getItemDetails(userId, libraryItemId).pipe(
      switchMap((localItem) => {
        if (!this.tmdb.isConfigured() || !localItem.TmdbId || !localItem.TmdbMediaType) {
          return of(localItem);
        }

        return this.tmdb.getDetails(localItem.TmdbMediaType, localItem.TmdbId).pipe(
          map((tmdbItem) => (tmdbItem ? this.library.mergeCatalogWithLibrary(tmdbItem, localItem) : localItem)),
          catchError(() => of(localItem))
        );
      }),
      catchError(() => of(this.missingItem(itemId)))
    );
  }

  getRecommended(userId: string, itemId: string): Observable<MediaItem[]> {
    return this.getDetails(userId, itemId).pipe(
      switchMap((item) => {
        if (item.Source === 'mock') {
          return of(MOCK_HOME_CATALOG.recommendedForYou.filter((candidate) => candidate.Id !== item.Id).slice(0, 12));
        }

        const genreId = item.GenreIds?.[0] ? `${item.GenreIds[0]}` : undefined;
        const source$ = item.TmdbMediaType === 'tv' ? this.getSeries(userId, genreId) : this.getMovies(userId, genreId);

        return source$.pipe(map((items) => items.filter((candidate) => candidate.Id !== item.Id).slice(0, 12)));
      })
    );
  }

  search(userId: string, term: string): Observable<MediaItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalSearch(userId, term);
    }

    return this.tmdb.search(term, 30).pipe(
      switchMap((items) => this.library.matchCatalogItems(userId, items)),
      catchError(() => of([] as MediaItem[]))
    );
  }

  toggleFavorite(userId: string, item: MediaItem, isFavorite: boolean) {
    const libraryItemId = this.playbackTargetId(item);

    if (!libraryItemId) {
      return of(undefined);
    }

    return isFavorite
      ? this.api.delete<void>(`/Users/${userId}/FavoriteItems/${libraryItemId}`)
      : this.api.post<void>(`/Users/${userId}/FavoriteItems/${libraryItemId}`, {});
  }

  posterUrl(item: MediaItem, width = 480): string | null {
    if (item.PosterPath) {
      return this.tmdb.posterUrl(item.PosterPath, width);
    }

    const tag = item.ImageTags?.Primary;

    if (tag) {
      return this.api.imageUrl(this.playbackTargetId(item) ?? item.Id, 'Primary', tag, width);
    }

    return item.MockPosterUrl ?? null;
  }

  backdropUrl(item: MediaItem, width = 1600): string | null {
    if (item.BackdropPath) {
      return this.tmdb.backdropUrl(item.BackdropPath, width);
    }

    const targetId = this.playbackTargetId(item) ?? item.Id;
    const tag = item.BackdropImageTags?.[0];

    if (tag) {
      return this.api.imageUrl(targetId, 'Backdrop', tag, width);
    }

    if (item.ParentBackdropItemId) {
      return this.api.imageUrl(item.ParentBackdropItemId, 'Backdrop', undefined, width);
    }

    return item.MockBackdropUrl ?? null;
  }

  runtimeText(item: MediaItem): string {
    const totalMinutes = Math.round((item.RunTimeTicks ?? 0) / 10_000_000 / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (!totalMinutes) {
      return item.Type === 'Series' ? 'Series' : 'Feature';
    }

    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  releaseYear(item: MediaItem): string {
    const year = item.ProductionYear ?? (item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : null);
    return year ? `${year}` : 'New';
  }

  ratingText(item: MediaItem): string {
    if (item.CommunityRating) {
      return `${item.CommunityRating.toFixed(1)}`;
    }

    if (item.OfficialRating?.trim()) {
      return item.OfficialRating;
    }

    return item.Available ? 'Ready' : 'Featured';
  }

  genreText(item: MediaItem, limit = 3): string {
    return item.Genres?.slice(0, limit).join(' / ') || 'Now streaming';
  }

  resumeTimeText(item: MediaItem): string {
    const positionTicks = item.UserData?.PlaybackPositionTicks ?? 0;
    const minutes = Math.max(1, Math.round(positionTicks / 10_000_000 / 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (!positionTicks) {
      return 'Start from the beginning';
    }

    return hours ? `Resume at ${hours}h ${remainingMinutes}m` : `Resume at ${remainingMinutes}m`;
  }

  resumePercent(item: MediaItem): number {
    const position = item.UserData?.PlaybackPositionTicks ?? 0;
    const runtime = item.RunTimeTicks ?? 0;
    return runtime ? Math.min(100, (position / runtime) * 100) : 0;
  }

  playbackTargetId(item: MediaItem): string | null {
    const parsed = this.parseRouteId(item.Id);
    return item.LibraryItemId ?? (parsed.kind === 'jellyfin' ? parsed.libraryItemId : null);
  }

  isPlayable(item: MediaItem): boolean {
    return Boolean(item.Available && this.playbackTargetId(item));
  }

  private getTmdbHomeSections(userId: string): Observable<HomeSections> {
    return combineLatest([
      this.tmdb.getTrending(18),
      this.tmdb.getPopularMovies(18),
      this.tmdb.getTopRatedMovies(18),
      this.tmdb.getNewReleases(18),
      this.tmdb.getMoviesByGenre(ACTION_GENRE_ID, 18),
      this.tmdb.getMoviesByGenre(SCI_FI_GENRE_ID, 18),
      this.tmdb.getTvShows(18),
      this.getContinueWatching(userId),
      this.getGenres(userId)
    ]).pipe(
      switchMap(([trending, popular, topRated, newReleases, actionMovies, sciFiMovies, tvShows, continueWatching, genres]) =>
        combineLatest([
          this.library.matchCatalogItems(userId, this.pickDistinct([...trending, ...popular, ...tvShows], 5)),
          this.library.matchCatalogItems(userId, this.pickDistinct([...topRated, ...newReleases, ...popular], 4)),
          this.library.matchCatalogItems(userId, trending.slice(0, 12)),
          this.library.matchCatalogItems(userId, popular.slice(0, 12)),
          this.library.matchCatalogItems(userId, newReleases.slice(0, 12)),
          this.library.matchCatalogItems(userId, topRated.slice(0, 12)),
          this.library.matchCatalogItems(userId, actionMovies.slice(0, 12)),
          this.library.matchCatalogItems(userId, sciFiMovies.slice(0, 12)),
          this.library.matchCatalogItems(userId, tvShows.slice(0, 12)),
          of(continueWatching),
          of(genres)
        ])
      ),
      map(
        ([
          heroItems,
          spotlightPicks,
          trendingNow,
          popularMovies,
          newReleases,
          recommendedForYou,
          actionMovies,
          sciFi,
          tvShows,
          continueWatching,
          genres
        ]) =>
          this.enrichWithMockCatalog({
            heroItems,
            spotlightPicks,
            continueWatching,
            trendingNow,
            popularMovies,
            newReleases,
            recommendedForYou,
            actionMovies,
            sciFi,
            tvShows,
            genres
          })
      )
    );
  }

  private getLocalHomeSections(userId: string): Observable<HomeSections> {
    return combineLatest([
      this.getLocalTrendingMovies(userId),
      this.getContinueWatching(userId),
      this.getLocalRecentlyAdded(userId),
      this.getLocalMovies(userId),
      this.getLocalSeries(userId),
      this.getLocalGenres(userId)
    ]).pipe(
      map(([trendingNow, continueWatching, recentlyAdded, movies, tvShows, genres]) => {
        const heroItems = this.pickDistinct([...trendingNow, ...recentlyAdded, ...movies, ...tvShows], 4);
        const excluded = heroItems.map((item) => item.Id);

        return this.enrichWithMockCatalog({
          heroItems,
          spotlightPicks: this.pickDistinct([...recentlyAdded, ...tvShows, ...movies], 4, excluded),
          continueWatching: continueWatching.slice(0, 8),
          trendingNow: this.pickDistinct(trendingNow, 12),
          popularMovies: this.pickTopRated([...movies, ...trendingNow], 12, excluded),
          newReleases: this.pickDistinct(recentlyAdded, 12),
          recommendedForYou: this.pickDistinct(
            [...continueWatching, ...recentlyAdded, ...movies, ...tvShows],
            12,
            excluded
          ),
          actionMovies: this.pickByGenre(movies, ['Action', 'Adventure', 'Thriller'], 12, excluded),
          sciFi: this.pickByGenre(movies, ['Science Fiction', 'Sci-Fi', 'Sci Fi', 'Fantasy'], 12, excluded),
          tvShows: this.pickDistinct(tvShows, 12),
          genres: genres.slice(0, 8)
        });
      })
    );
  }

  private getLocalTrendingMovies(userId: string): Observable<MediaItem[]> {
    return this.localItems(userId, {
      Fields: LOCAL_ITEM_FIELDS,
      ImageTypeLimit: 1,
      IncludeItemTypes: 'Movie',
      Limit: 18,
      Recursive: true,
      SortBy: 'CommunityRating,PremiereDate',
      SortOrder: 'Descending'
    });
  }

  private getLocalRecentlyAdded(userId: string): Observable<MediaItem[]> {
    return this.localItems(userId, {
      Fields: LOCAL_ITEM_FIELDS,
      ImageTypeLimit: 1,
      IncludeItemTypes: 'Movie,Series',
      Limit: 18,
      Recursive: true,
      SortBy: 'DateCreated',
      SortOrder: 'Descending'
    });
  }

  private getLocalMovies(userId: string, genre?: string): Observable<MediaItem[]> {
    return this.localItems(userId, {
      Fields: LOCAL_ITEM_FIELDS,
      GenreIds: genre,
      ImageTypeLimit: 1,
      IncludeItemTypes: 'Movie',
      Limit: 60,
      Recursive: true,
      SortBy: 'SortName'
    });
  }

  private getLocalSeries(userId: string, genre?: string): Observable<MediaItem[]> {
    return this.localItems(userId, {
      Fields: LOCAL_ITEM_FIELDS,
      GenreIds: genre,
      ImageTypeLimit: 1,
      IncludeItemTypes: 'Series',
      Limit: 60,
      Recursive: true,
      SortBy: 'SortName'
    });
  }

  private getLocalFavorites(userId: string): Observable<MediaItem[]> {
    return this.localItems(userId, {
      Fields: LOCAL_ITEM_FIELDS,
      Filters: 'IsFavorite',
      IncludeItemTypes: 'Movie,Series',
      Limit: 60,
      Recursive: true
    });
  }

  private getLocalGenres(userId: string): Observable<GenreItem[]> {
    return this.api
      .get<{ Items: GenreItem[] }>(`/Genres`, {
        IncludeItemTypes: 'Movie,Series',
        Limit: 16,
        Recursive: true,
        UserId: userId
      })
      .pipe(
        map((response) => response.Items ?? []),
        catchError(() => of(MOCK_HOME_CATALOG.genres))
      );
  }

  private getLocalSearch(userId: string, term: string): Observable<MediaItem[]> {
    return this.localItems(userId, {
      Fields: LOCAL_ITEM_FIELDS,
      IncludeItemTypes: 'Movie,Series',
      Limit: 24,
      Recursive: true,
      SearchTerm: term
    });
  }

  private localItems(userId: string, params: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<MediaCollectionResponse>(`/Users/${userId}/Items`, {
        UserId: userId,
        ...params
      })
      .pipe(
        map((response) => (response.Items ?? []).map((item) => this.library.normalizeLocalItem(item))),
        catchError(() => of([] as MediaItem[]))
      );
  }

  private matchCatalogSource(
    userId: string,
    source$: Observable<MediaItem[]>,
    fallback: MediaItem[],
    limit: number
  ): Observable<MediaItem[]> {
    return source$.pipe(
      switchMap((items) => this.library.matchCatalogItems(userId, items)),
      map((items) => this.mergeRows(items, fallback, limit)),
      catchError(() => of(this.mergeRows([], fallback, limit)))
    );
  }

  private enrichWithMockCatalog(partial: HomeSections): HomeSections {
    return {
      heroItems: this.mergeRows(partial.heroItems, MOCK_HOME_CATALOG.heroItems, 4),
      spotlightPicks: this.mergeRows(partial.spotlightPicks, MOCK_HOME_CATALOG.spotlightPicks, 4),
      continueWatching: this.mergeRows(partial.continueWatching, MOCK_HOME_CATALOG.continueWatching, 8),
      trendingNow: this.mergeRows(partial.trendingNow, MOCK_HOME_CATALOG.trendingNow, 12),
      popularMovies: this.mergeRows(partial.popularMovies, MOCK_HOME_CATALOG.popularMovies, 12),
      newReleases: this.mergeRows(partial.newReleases, MOCK_HOME_CATALOG.newReleases, 12),
      recommendedForYou: this.mergeRows(partial.recommendedForYou, MOCK_HOME_CATALOG.recommendedForYou, 12),
      actionMovies: this.mergeRows(partial.actionMovies, MOCK_HOME_CATALOG.actionMovies, 12),
      sciFi: this.mergeRows(partial.sciFi, MOCK_HOME_CATALOG.sciFi, 12),
      tvShows: this.mergeRows(partial.tvShows, MOCK_HOME_CATALOG.tvShows, 12),
      genres: partial.genres.length ? partial.genres : MOCK_HOME_CATALOG.genres
    };
  }

  private mergeRows(primary: MediaItem[], fallback: MediaItem[], limit: number) {
    return this.pickDistinct([...primary, ...fallback], limit);
  }

  private pickDistinct(items: MediaItem[], limit: number, excludeIds: string[] = []): MediaItem[] {
    const seen = new Set(excludeIds);
    const result: MediaItem[] = [];

    for (const item of items) {
      if (!item?.Id || seen.has(item.Id)) {
        continue;
      }

      seen.add(item.Id);
      result.push(item);

      if (result.length >= limit) {
        break;
      }
    }

    return result;
  }

  private pickTopRated(items: MediaItem[], limit: number, excludeIds: string[] = []) {
    return this.pickDistinct(
      [...items].sort((left, right) => (right.CommunityRating ?? 0) - (left.CommunityRating ?? 0)),
      limit,
      excludeIds
    );
  }

  private pickByGenre(items: MediaItem[], names: string[], limit: number, excludeIds: string[] = []) {
    const matches = items.filter((item) =>
      item.Genres?.some((genre) =>
        names.some((name) => {
          const normalizedName = name.toLowerCase();
          const normalizedGenre = genre.toLowerCase();
          return normalizedName.includes(normalizedGenre) || normalizedGenre.includes(normalizedName);
        })
      )
    );

    return this.pickDistinct(matches.length ? matches : items, limit, excludeIds);
  }

  private parseRouteId(routeId: string):
    | { kind: 'tmdb'; mediaType: 'movie' | 'tv'; tmdbId: number }
    | { kind: 'jellyfin'; libraryItemId: string } {
    const tmdbMatch = /^tmdb-(movie|tv)-(\d+)$/.exec(routeId);

    if (tmdbMatch) {
      return {
        kind: 'tmdb',
        mediaType: tmdbMatch[1] as 'movie' | 'tv',
        tmdbId: Number(tmdbMatch[2])
      };
    }

    if (routeId.startsWith('jf-')) {
      return {
        kind: 'jellyfin',
        libraryItemId: routeId.slice(3)
      };
    }

    return {
      kind: 'jellyfin',
      libraryItemId: routeId
    };
  }

  private missingItem(itemId: string): MediaItem {
    return (
      MOCK_ITEM_LOOKUP.get(itemId) ?? {
        Id: itemId,
        Name: 'Title unavailable',
        Type: 'Movie',
        Overview: 'This title is not available right now, but it can still be saved for later.',
        Genres: ['Featured'],
        Source: 'mock',
        Available: false
      }
    );
  }
}
