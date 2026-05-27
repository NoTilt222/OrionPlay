export interface JellyfinUserData {
  IsFavorite?: boolean;
  Played?: boolean;
  PlaybackPositionTicks?: number;
  PlayCount?: number;
  LastPlayedDate?: string;
}

export interface JellyfinMediaSource {
  Id?: string;
  Name?: string;
  Path?: string;
  Container?: string;
  Size?: number;
  RunTimeTicks?: number;
  MediaStreams?: JellyfinMediaStream[];
}

export interface JellyfinMediaStream {
  Index?: number;
  DisplayTitle?: string;
  Language?: string;
  IsDefault?: boolean;
  Type?: string;
  Codec?: string;
  IsExternal?: boolean;
}

export interface MediaCastMember {
  Id: string;
  Name: string;
  Character?: string;
  ProfileUrl?: string | null;
}

export interface MediaTrailer {
  Id: string;
  Name: string;
  Key: string;
  Site: string;
  Type?: string;
  Url?: string;
}

export interface MediaItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  Tagline?: string;
  Genres?: string[];
  RunTimeTicks?: number;
  PremiereDate?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  Tags?: string[];
  MediaSources?: JellyfinMediaSource[];
  MediaStreams?: JellyfinMediaStream[];
  UserData?: JellyfinUserData;
  ParentBackdropItemId?: string;
  BackdropImageTags?: string[];
  ImageTags?: Record<string, string>;
  ProviderIds?: Record<string, string>;
  MockPosterUrl?: string;
  MockBackdropUrl?: string;
  PosterPath?: string | null;
  BackdropPath?: string | null;
  GenreIds?: number[];
  TmdbId?: number;
  TmdbMediaType?: 'movie' | 'tv';
  LibraryItemId?: string;
  Available?: boolean;
  Source?: 'jellyfin' | 'tmdb' | 'hybrid' | 'mock';
  Cast?: MediaCastMember[];
  Trailers?: MediaTrailer[];
}

export interface MediaCollectionResponse {
  Items: MediaItem[];
  TotalRecordCount: number;
}

export interface GenreItem {
  Id?: string;
  Name: string;
}
