import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, combineLatest, map, Observable, of, shareReplay } from 'rxjs';
import { GenreItem, MediaCastMember, MediaItem, MediaTrailer } from '../models/media.model';
import {
  TmdbGenre,
  TmdbGenreListResponse,
  TmdbMediaDetails,
  TmdbMediaSummary,
  TmdbMediaType,
  TmdbPagedResponse,
  TmdbVideo
} from '../models/tmdb.model';
import { AppConfigService } from './app-config.service';

type QueryValue = string | number | boolean | undefined | null;

@Injectable({ providedIn: 'root' })
export class TmdbApiService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(AppConfigService);
  private readonly responseCache = new Map<string, Observable<unknown>>();

  isConfigured(): boolean {
    return Boolean(this.configService.tmdb.apiReadToken?.trim());
  }

  getGenres(): Observable<GenreItem[]> {
    if (!this.isConfigured()) {
      return of([]);
    }

    return combineLatest([this.getMovieGenres(), this.getTvGenres()]).pipe(
      map(([movieGenres, tvGenres]) => {
        const deduped = new Map<string, GenreItem>();

        for (const genre of [...movieGenres, ...tvGenres]) {
          deduped.set(`${genre.id}`, { Id: `${genre.id}`, Name: genre.name });
        }

        return [...deduped.values()].sort((left, right) => left.Name.localeCompare(right.Name));
      })
    );
  }

  getGenreMap(): Observable<Map<number, string>> {
    if (!this.isConfigured()) {
      return of(new Map<number, string>());
    }

    return combineLatest([this.getMovieGenres(), this.getTvGenres()]).pipe(
      map(([movieGenres, tvGenres]) => {
        const genreMap = new Map<number, string>();

        for (const genre of [...movieGenres, ...tvGenres]) {
          genreMap.set(genre.id, genre.name);
        }

        return genreMap;
      }),
      shareReplay(1)
    );
  }

  getTrending(limit = 20): Observable<MediaItem[]> {
    if (!this.isConfigured()) {
      return of([]);
    }

    return combineLatest([this.getTrendingMovies(limit), this.getTrendingTv(limit)]).pipe(
      map(([movies, tvShows]) => this.mixAndLimit([...movies, ...tvShows], limit))
    );
  }

  getTrendingMovies(limit = 20): Observable<MediaItem[]> {
    return this.getCatalogList('/trending/movie/week', { page: 1 }, limit, 'movie');
  }

  getTrendingTv(limit = 20): Observable<MediaItem[]> {
    return this.getCatalogList('/trending/tv/week', { page: 1 }, limit, 'tv');
  }

  getPopularMovies(limit = 24): Observable<MediaItem[]> {
    return this.getCatalogList(
      '/discover/movie',
      {
        include_adult: false,
        include_video: false,
        page: 1,
        region: this.configService.tmdb.region,
        sort_by: 'popularity.desc',
        'vote_count.gte': 80
      },
      limit,
      'movie'
    );
  }

  getTopRatedMovies(limit = 24): Observable<MediaItem[]> {
    return this.getCatalogList(
      '/discover/movie',
      {
        include_adult: false,
        include_video: false,
        page: 1,
        region: this.configService.tmdb.region,
        sort_by: 'vote_average.desc',
        'vote_count.gte': 800
      },
      limit,
      'movie'
    );
  }

  getNewReleases(limit = 24): Observable<MediaItem[]> {
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    return this.getCatalogList(
      '/discover/movie',
      {
        include_adult: false,
        include_video: false,
        page: 1,
        region: this.configService.tmdb.region,
        sort_by: 'primary_release_date.desc',
        'primary_release_date.gte': this.formatDate(sixMonthsAgo),
        'primary_release_date.lte': this.formatDate(today)
      },
      limit,
      'movie'
    );
  }

  getMoviesByGenre(genreId: string, limit = 24): Observable<MediaItem[]> {
    return this.getCatalogList(
      '/discover/movie',
      {
        include_adult: false,
        include_video: false,
        page: 1,
        region: this.configService.tmdb.region,
        sort_by: 'popularity.desc',
        with_genres: genreId
      },
      limit,
      'movie'
    );
  }

  getTvShows(limit = 24, genreId?: string): Observable<MediaItem[]> {
    return this.getCatalogList(
      '/discover/tv',
      {
        include_adult: false,
        page: 1,
        sort_by: 'popularity.desc',
        with_genres: genreId,
        'vote_count.gte': 60
      },
      limit,
      'tv'
    );
  }

  search(term: string, limit = 24): Observable<MediaItem[]> {
    if (!term.trim()) {
      return of([]);
    }

    return this.getCatalogList(
      '/search/multi',
      {
        include_adult: false,
        page: 1,
        query: term.trim()
      },
      limit
    );
  }

  getDetails(mediaType: TmdbMediaType, tmdbId: number): Observable<MediaItem | null> {
    if (!this.isConfigured()) {
      return of(null);
    }

    return this.cachedRequest<TmdbMediaDetails | null>(
      `/${mediaType}/${tmdbId}`,
      {
        append_to_response: 'credits,videos,external_ids'
      },
      null
    ).pipe(map((details) => (details ? this.toMediaItem(details, mediaType) : null)));
  }

  posterUrl(path: string | null | undefined, width = 500): string | null {
    if (!path) {
      return null;
    }

    return `${this.configService.tmdb.imageBaseUrl}/${this.posterSize(width)}${path}`;
  }

  backdropUrl(path: string | null | undefined, width = 1280): string | null {
    if (!path) {
      return null;
    }

    return `${this.configService.tmdb.imageBaseUrl}/${this.backdropSize(width)}${path}`;
  }

  profileUrl(path: string | null | undefined, width = 185): string | null {
    if (!path) {
      return null;
    }

    return `${this.configService.tmdb.imageBaseUrl}/${width >= 300 ? 'w300' : 'w185'}${path}`;
  }

  createRouteId(mediaType: TmdbMediaType, tmdbId: number): string {
    return `tmdb-${mediaType}-${tmdbId}`;
  }

  private getMovieGenres(): Observable<TmdbGenre[]> {
    return this.cachedRequest<TmdbGenreListResponse>('/genre/movie/list', {}, { genres: [] }).pipe(
      map((response) => response.genres ?? [])
    );
  }

  private getTvGenres(): Observable<TmdbGenre[]> {
    return this.cachedRequest<TmdbGenreListResponse>('/genre/tv/list', {}, { genres: [] }).pipe(
      map((response) => response.genres ?? [])
    );
  }

  private getCatalogList(
    path: string,
    params: Record<string, QueryValue>,
    limit: number,
    forcedMediaType?: TmdbMediaType
  ): Observable<MediaItem[]> {
    if (!this.isConfigured()) {
      return of([]);
    }

    return combineLatest([
      this.cachedRequest<TmdbPagedResponse<TmdbMediaSummary>>(path, params, {
        page: 1,
        results: [],
        total_pages: 0,
        total_results: 0
      }),
      this.getGenreMap()
    ]).pipe(
      map(([response, genreMap]) =>
        response.results
          .filter((item) => (forcedMediaType ?? item.media_type) !== 'person')
          .map((item) => this.toMediaItem(item, forcedMediaType, genreMap))
          .filter((item) => Boolean(item.Name))
          .slice(0, limit)
      )
    );
  }

  private toMediaItem(
    item: TmdbMediaSummary | TmdbMediaDetails,
    forcedMediaType?: TmdbMediaType,
    genreMap?: Map<number, string>
  ): MediaItem {
    const mediaType = forcedMediaType ?? (item.media_type === 'tv' ? 'tv' : 'movie');
    const isTv = mediaType === 'tv';
    const details = item as TmdbMediaDetails;
    const releaseDate = isTv ? item.first_air_date : item.release_date;
    const runtimeMinutes = isTv ? details.episode_run_time?.[0] : details.runtime;
    const genreIds = item.genre_ids ?? details.genres?.map((genre) => genre.id) ?? [];
    const genres =
      details.genres?.map((genre) => genre.name) ??
      genreIds.map((genreId) => genreMap?.get(genreId)).filter(Boolean) ??
      [];

    return {
      Id: this.createRouteId(mediaType, item.id),
      Name: isTv ? item.name || item.original_name || '' : item.title || item.original_title || '',
      Type: isTv ? 'Series' : 'Movie',
      Overview: item.overview || '',
      Tagline: details.tagline || '',
      Genres: genres as string[],
      GenreIds: genreIds,
      RunTimeTicks: runtimeMinutes ? runtimeMinutes * 60 * 10_000_000 : undefined,
      PremiereDate: releaseDate || undefined,
      ProductionYear: releaseDate ? new Date(releaseDate).getFullYear() : undefined,
      CommunityRating: item.vote_average ?? undefined,
      PosterPath: item.poster_path ?? null,
      BackdropPath: item.backdrop_path ?? null,
      TmdbId: item.id,
      TmdbMediaType: mediaType,
      Source: 'tmdb',
      Available: false,
      ProviderIds: this.toProviderIds(details),
      Cast: this.toCast(details.credits?.cast ?? []),
      Trailers: this.toTrailers(details.videos?.results ?? [])
    };
  }

  private toProviderIds(item: TmdbMediaDetails): Record<string, string> | undefined {
    const providerIds: Record<string, string> = {};

    if (item.id) {
      providerIds['Tmdb'] = `${item.id}`;
    }

    if (item.external_ids?.imdb_id) {
      providerIds['Imdb'] = item.external_ids.imdb_id;
    }

    if (item.external_ids?.tvdb_id) {
      providerIds['Tvdb'] = `${item.external_ids.tvdb_id}`;
    }

    return Object.keys(providerIds).length ? providerIds : undefined;
  }

  private toCast(cast: Array<{ id: number; name: string; character?: string; profile_path?: string | null }>): MediaCastMember[] {
    return (cast ?? [])
      .slice(0, 8)
      .map((member) => ({
        Id: `${member.id}`,
        Name: member.name,
        Character: member.character,
        ProfileUrl: this.profileUrl(member.profile_path ?? null)
      }));
  }

  private toTrailers(videos: TmdbVideo[]): MediaTrailer[] {
    return videos
      .filter((video) => video.site === 'YouTube' || video.site === 'Vimeo')
      .sort((left, right) => {
        if (left.official && !right.official) {
          return -1;
        }

        if (!left.official && right.official) {
          return 1;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 3)
      .map((video) => ({
        Id: video.id,
        Key: video.key,
        Name: video.name,
        Site: video.site,
        Type: video.type,
        Url:
          video.site === 'YouTube'
            ? `https://www.youtube.com/watch?v=${video.key}`
            : `https://vimeo.com/${video.key}`
      }));
  }

  private cachedRequest<T>(path: string, params: Record<string, QueryValue>, fallback: T): Observable<T> {
    if (!this.isConfigured()) {
      return of(fallback);
    }

    const key = `${path}?${JSON.stringify(params)}`;
    const cached = this.responseCache.get(key) as Observable<T> | undefined;

    if (cached) {
      return cached;
    }

    const request$ = this.http
      .get<T>(this.buildUrl(path), {
        headers: new HttpHeaders({
          accept: 'application/json',
          Authorization: `Bearer ${this.configService.tmdb.apiReadToken}`
        }),
        params: this.toParams({
          language: this.configService.tmdb.language,
          ...params
        })
      })
      .pipe(
        catchError(() => of(fallback)),
        shareReplay(1)
      );

    this.responseCache.set(key, request$);
    return request$;
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.configService.tmdb.apiBaseUrl}${normalizedPath}`;
  }

  private toParams(params: Record<string, QueryValue>): HttpParams {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, `${value}`);
      }
    }

    return httpParams;
  }

  private mixAndLimit(items: MediaItem[], limit: number): MediaItem[] {
    const seen = new Set<string>();
    const mixed: MediaItem[] = [];

    for (const item of items) {
      if (!item?.Id || seen.has(item.Id)) {
        continue;
      }

      seen.add(item.Id);
      mixed.push(item);

      if (mixed.length >= limit) {
        break;
      }
    }

    return mixed;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private posterSize(width: number): string {
    if (width >= 780) {
      return 'w780';
    }

    if (width >= 500) {
      return 'w500';
    }

    return 'w342';
  }

  private backdropSize(width: number): string {
    if (width >= 1280) {
      return 'w1280';
    }

    if (width >= 780) {
      return 'w780';
    }

    return 'w500';
  }
}
