export type TmdbMediaType = 'movie' | 'tv';

export interface TmdbPagedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbGenreListResponse {
  genres: TmdbGenre[];
}

export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type?: string;
  official?: boolean;
  published_at?: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
}

export interface TmdbMediaSummary {
  adult?: boolean;
  backdrop_path?: string | null;
  first_air_date?: string;
  genre_ids?: number[];
  id: number;
  media_type?: TmdbMediaType | 'person';
  name?: string;
  original_language?: string;
  original_name?: string;
  original_title?: string;
  overview?: string;
  popularity?: number;
  poster_path?: string | null;
  release_date?: string;
  title?: string;
  video?: boolean;
  vote_average?: number;
  vote_count?: number;
}

export interface TmdbMediaDetails extends TmdbMediaSummary {
  credits?: {
    cast?: TmdbCastMember[];
  };
  episode_run_time?: number[];
  external_ids?: {
    imdb_id?: string | null;
    tvdb_id?: number | null;
  };
  genres?: TmdbGenre[];
  runtime?: number;
  tagline?: string;
  videos?: {
    results?: TmdbVideo[];
  };
}
