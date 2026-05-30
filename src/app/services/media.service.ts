import { Injectable, inject } from '@angular/core';
import { catchError, combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { GenreItem, MediaCollectionResponse, MediaItem } from '../models/media.model';
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

export const EMPTY_HOME_SECTIONS: HomeSections = {
  heroItems: [],
  spotlightPicks: [],
  continueWatching: [],
  trendingNow: [],
  popularMovies: [],
  newReleases: [],
  recommendedForYou: [],
  actionMovies: [],
  sciFi: [],
  tvShows: [],
  genres: []
};

const ACTION_GENRE_ID = '28';
const SCI_FI_GENRE_ID = '878';
const HOME_MIN_YEAR = 2000;
const HOME_MAX_YEAR = 2026;
const MIN_UNAVAILABLE_RELEASE_AGE_DAYS = 45;
const RECENT_RELEASE_MAX_AGE_DAYS = 365 * 4;
const CATALOG_RELEASE_MAX_AGE_DAYS = 365 * 12;
const NEW_RELEASE_MIN_AGE_DAYS = 30;
const NEW_RELEASE_MAX_AGE_DAYS = 365 * 2;
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
    return source$.pipe(catchError(() => of(EMPTY_HOME_SECTIONS)));
  }

  getTrendingMovies(userId: string): Observable<MediaItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalTrendingMovies(userId);
    }

    return this.matchCatalogSource(
      userId,
      this.tmdb.getTrending(18),
      18,
      (items, limit) => this.pickBalancedCatalog(items, limit)
    );
  }

  getRecentlyAdded(userId: string): Observable<MediaItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalRecentlyAdded(userId);
    }

    return this.matchCatalogSource(
      userId,
      this.tmdb.getNewReleases(18),
      18,
      (items, limit) => this.pickBalancedNewReleases(items, limit)
    );
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
        catchError(() => of([] as MediaItem[]))
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
        ]).pipe(map(([popular, topRated, newReleases]) => this.pickDistinct([...popular, ...topRated, ...newReleases], 48)));

    return this.matchCatalogSource(
      userId,
      source$,
      36,
      (items, limit) => this.pickBalancedCatalog(items, limit)
    );
  }

  getSeries(userId: string, genre?: string): Observable<MediaItem[]> {
    if (!this.tmdb.isConfigured()) {
      return this.getLocalSeries(userId, genre);
    }

    return this.matchCatalogSource(
      userId,
      this.tmdb.getTvShows(36, genre),
      36,
      (items, limit) => this.pickBalancedCatalog(items, limit)
    );
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
      catchError(() => of([] as GenreItem[]))
    );
  }

  getDetails(userId: string, itemId: string): Observable<MediaItem> {
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

    return null;
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

    return null;
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
      this.getGenres(userId),
      this.getLocalRecentlyAdded(userId),
      this.getLocalMovies(userId),
      this.getLocalSeries(userId)
    ]).pipe(
      switchMap(
        ([
          trending,
          popular,
          topRated,
          newReleases,
          actionMovies,
          sciFiMovies,
          tvShows,
          continueWatching,
          genres,
          localRecentlyAdded,
          localMovies,
          localSeries
        ]) =>
        combineLatest([
          this.library.matchCatalogItems(userId, this.pickDistinct([...trending, ...popular, ...tvShows], 12)),
          this.library.matchCatalogItems(userId, this.pickDistinct([...topRated, ...newReleases, ...popular], 12)),
          this.library.matchCatalogItems(userId, trending.slice(0, 12)),
          this.library.matchCatalogItems(userId, popular.slice(0, 12)),
          this.library.matchCatalogItems(userId, newReleases.slice(0, 12)),
          this.library.matchCatalogItems(userId, topRated.slice(0, 12)),
          this.library.matchCatalogItems(userId, actionMovies.slice(0, 12)),
          this.library.matchCatalogItems(userId, sciFiMovies.slice(0, 12)),
          this.library.matchCatalogItems(userId, tvShows.slice(0, 12)),
          of(continueWatching),
          of(genres),
          of(localRecentlyAdded),
          of(localMovies),
          of(localSeries)
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
          genres,
          localRecentlyAdded,
          localMovies,
          localSeries
        ]) => {
          const localRecentMovies = localRecentlyAdded.filter((item) => item.Type === 'Movie');
          const localRecentSeries = localRecentlyAdded.filter((item) => item.Type === 'Series');
          const localMoviePool = this.pickDistinct(
            [...localRecentMovies, ...this.pickTopRated(localMovies, 18), ...localMovies],
            24
          );
          const localSeriesPool = this.pickDistinct(
            [...localRecentSeries, ...this.pickTopRated(localSeries, 18), ...localSeries],
            18
          );
          const localActionMovies = this.pickByGenre(localMoviePool, ['Action', 'Adventure', 'Thriller'], 12);
          const localSciFiMovies = this.pickByGenre(localMoviePool, ['Science Fiction', 'Sci-Fi', 'Sci Fi', 'Fantasy'], 12);
          const curatedHeroItems = this.preferInstalledInRow(
            this.pickBalancedCatalog(
              this.pickDistinct([...localRecentMovies, ...heroItems, ...localMoviePool, ...localSeriesPool], 18),
              8
            ),
            4,
            [],
            2
          );
          const curatedHeroIds = curatedHeroItems.map((item) => item.Id);

          return this.finalizeHomeSections({
            heroItems: curatedHeroItems,
            spotlightPicks: this.preferInstalledInRow(
              this.pickBalancedCatalog(
                this.pickDistinct([...spotlightPicks, ...localRecentMovies, ...localMoviePool], 18),
                8,
                curatedHeroIds
              ),
              4,
              curatedHeroIds,
              2
            ),
            continueWatching,
            trendingNow: this.preferInstalledInRow(
              this.pickBalancedCatalog(this.pickDistinct([...trendingNow, ...localRecentMovies, ...localMoviePool], 24), 12),
              12,
              [],
              4
            ),
            popularMovies: this.preferInstalledInRow(
              this.pickBalancedCatalog(
                this.pickDistinct([...popularMovies, ...this.pickTopRated(localMoviePool, 12), ...localRecentMovies], 24),
                12
              ),
              12,
              [],
              4
            ),
            newReleases: this.preferInstalledInRow(
              this.pickBalancedNewReleases(
                this.pickDistinct([...newReleases, ...localRecentMovies, ...localMoviePool], 24),
                12
              ),
              12,
              [],
              4
            ),
            recommendedForYou: this.preferInstalledInRow(
              this.pickBalancedCatalog(
                this.pickDistinct(
                  [...continueWatching, ...recommendedForYou, ...localRecentMovies, ...this.pickTopRated(localMoviePool, 12)],
                  24
                ),
                12
              ),
              12,
              [],
              4
            ),
            actionMovies: this.preferInstalledInRow(
              this.pickBalancedCatalog(this.pickDistinct([...actionMovies, ...localActionMovies, ...localRecentMovies], 24), 12),
              12,
              [],
              4
            ),
            sciFi: this.preferInstalledInRow(
              this.pickBalancedCatalog(this.pickDistinct([...sciFi, ...localSciFiMovies, ...localRecentMovies], 24), 12),
              12,
              [],
              4
            ),
            tvShows: this.preferInstalledInRow(
              this.pickBalancedCatalog(this.pickDistinct([...tvShows, ...localSeriesPool], 24), 12),
              12,
              [],
              4
            ),
            genres
          });
        }
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

        return this.finalizeHomeSections({
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
        catchError(() => of([] as GenreItem[]))
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
    limit: number,
    curate: (items: MediaItem[], limit: number) => MediaItem[] = (items, rowLimit) =>
      this.pickDistinct(items, rowLimit)
  ): Observable<MediaItem[]> {
    return source$.pipe(
      switchMap((items) => this.library.matchCatalogItems(userId, items)),
      map((items) => curate(items, limit)),
      catchError(() => of([] as MediaItem[]))
    );
  }

  private finalizeHomeSections(partial: HomeSections): HomeSections {
    const heroItems = this.pickDistinct(this.filterHomeYearWindow(partial.heroItems), 4);
    const trendingNow = this.pickDistinct(this.filterHomeYearWindow(partial.trendingNow), 12);
    const popularMovies = this.pickDistinct(this.filterHomeYearWindow(partial.popularMovies), 12);
    const newReleases = this.pickDistinct(this.filterHomeYearWindow(partial.newReleases), 12);
    const recommendedForYou = this.pickDistinct(this.filterHomeYearWindow(partial.recommendedForYou), 12);
    const actionMovies = this.pickDistinct(this.filterHomeYearWindow(partial.actionMovies), 12);
    const sciFi = this.pickDistinct(this.filterHomeYearWindow(partial.sciFi), 12);
    const tvShows = this.pickDistinct(this.filterHomeYearWindow(partial.tvShows), 12);
    const continueWatching = this.pickDistinct(this.filterHomeYearWindow(partial.continueWatching), 8);
    const spotlightSeed = this.filterHomeYearWindow(partial.spotlightPicks);
    const spotlightPicks = this.pickDistinct(
      [
        ...spotlightSeed,
        ...recommendedForYou,
        ...trendingNow,
        ...popularMovies,
        ...actionMovies,
        ...sciFi,
        ...tvShows
      ],
      4,
      heroItems.map((item) => item.Id)
    );

    return {
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
      genres: partial.genres.slice(0, 18)
    };
  }

  private pickBalancedCatalog(items: MediaItem[], limit: number, excludeIds: string[] = []) {
    const releasedItems = items.filter((item) => !this.isFutureRelease(item));
    const freshAvailable = releasedItems.filter(
      (item) => item.Available && this.isReleaseAgeBetween(item, 0, MIN_UNAVAILABLE_RELEASE_AGE_DAYS - 1)
    );
    const currentEra = releasedItems.filter((item) =>
      this.isReleaseAgeBetween(item, MIN_UNAVAILABLE_RELEASE_AGE_DAYS, RECENT_RELEASE_MAX_AGE_DAYS)
    );
    const established = releasedItems.filter((item) =>
      this.isReleaseAgeBetween(item, RECENT_RELEASE_MAX_AGE_DAYS + 1, CATALOG_RELEASE_MAX_AGE_DAYS)
    );
    const legacy = releasedItems.filter((item) => {
      const age = this.releaseAgeInDays(item);
      return age != null && age > CATALOG_RELEASE_MAX_AGE_DAYS;
    });
    const undated = releasedItems.filter((item) => this.releaseAgeInDays(item) == null);

    const seen = new Set(excludeIds);
    const result: MediaItem[] = [];

    this.pushDistinctInto(result, established, Math.max(1, Math.round(limit * 0.4)), seen);
    this.pushDistinctInto(result, currentEra, Math.max(1, Math.round(limit * 0.35)), seen);
    this.pushDistinctInto(result, freshAvailable, Math.max(1, Math.round(limit * 0.15)), seen);
    this.pushDistinctInto(result, [...undated, ...legacy], limit - result.length, seen);
    this.pushDistinctInto(result, releasedItems, limit - result.length, seen);

    return result.slice(0, limit);
  }

  private pickBalancedNewReleases(items: MediaItem[], limit: number, excludeIds: string[] = []) {
    const releasedItems = items.filter((item) => !this.isFutureRelease(item));
    const recentWindow = releasedItems.filter((item) =>
      this.isReleaseAgeBetween(item, NEW_RELEASE_MIN_AGE_DAYS, NEW_RELEASE_MAX_AGE_DAYS)
    );
    const freshAvailable = releasedItems.filter(
      (item) => item.Available && this.isReleaseAgeBetween(item, 0, NEW_RELEASE_MIN_AGE_DAYS - 1)
    );
    const fallbackCatalog = releasedItems.filter((item) =>
      this.isReleaseAgeBetween(item, NEW_RELEASE_MAX_AGE_DAYS + 1, CATALOG_RELEASE_MAX_AGE_DAYS)
    );
    const undated = releasedItems.filter((item) => this.releaseAgeInDays(item) == null);

    const seen = new Set(excludeIds);
    const result: MediaItem[] = [];

    this.pushDistinctInto(result, recentWindow, Math.max(1, Math.round(limit * 0.65)), seen);
    this.pushDistinctInto(result, fallbackCatalog, Math.max(1, Math.round(limit * 0.2)), seen);
    this.pushDistinctInto(result, freshAvailable, Math.max(1, Math.round(limit * 0.15)), seen);
    this.pushDistinctInto(result, undated, limit - result.length, seen);
    this.pushDistinctInto(result, releasedItems, limit - result.length, seen);

    return result.slice(0, limit);
  }

  private preferInstalledInRow(items: MediaItem[], limit: number, excludeIds: string[] = [], leadInstalledCount = 4) {
    const installedLead = this.pickDistinct(
      items.filter((item) => item.Available),
      Math.min(limit, leadInstalledCount),
      excludeIds
    );

    return this.pickDistinct([...installedLead, ...items], limit, excludeIds);
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

  private pushDistinctInto(result: MediaItem[], items: MediaItem[], targetCount: number, seen: Set<string>) {
    if (targetCount <= 0) {
      return;
    }

    const startingLength = result.length;

    for (const item of items) {
      if (!item?.Id || seen.has(item.Id)) {
        continue;
      }

      seen.add(item.Id);
      result.push(item);

      if (result.length - startingLength >= targetCount) {
        break;
      }
    }
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

  private releaseAgeInDays(item: MediaItem): number | null {
    const releaseDate = item.PremiereDate ? new Date(item.PremiereDate) : null;

    if (!releaseDate || Number.isNaN(releaseDate.getTime())) {
      return null;
    }

    return Math.floor((Date.now() - releaseDate.getTime()) / 86_400_000);
  }

  private isFutureRelease(item: MediaItem) {
    const age = this.releaseAgeInDays(item);
    return age != null && age < 0;
  }

  private isReleaseAgeBetween(item: MediaItem, minimumDays: number, maximumDays: number) {
    const age = this.releaseAgeInDays(item);
    return age != null && age >= minimumDays && age <= maximumDays;
  }

  private filterHomeYearWindow(items: MediaItem[]) {
    return items.filter((item) => {
      const year = item.ProductionYear ?? (item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : null);
      return year != null && year >= HOME_MIN_YEAR && year <= HOME_MAX_YEAR;
    });
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
    return {
      Id: itemId,
      Name: 'Title unavailable',
      Type: 'Movie',
      Overview: 'This title is not available right now, but it can still be saved for later.',
      Genres: ['Featured'],
      Source: 'tmdb',
      Available: false
    };
  }
}
