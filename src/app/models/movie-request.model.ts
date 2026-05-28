export interface MovieRequestPayload {
  title: string;
  tmdbId: number;
  releaseYear?: number;
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
  userName?: string;
  userEmail?: string;
  pageUrl?: string;
}

export interface MovieRequestApiResponse {
  ok: boolean;
  error?: 'validation_error' | 'email_send_failed' | 'configuration_error' | 'rate_limited' | 'method_not_allowed';
  message: string;
  requestId?: string;
}
