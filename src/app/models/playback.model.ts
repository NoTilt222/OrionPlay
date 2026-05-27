import type { JellyfinMediaSource, JellyfinMediaStream } from './media.model';

export interface PlaybackInfoResponse {
  MediaSources: JellyfinMediaSource[];
  PlaySessionId?: string;
}

export interface QualityOption {
  label: string;
  value: number;
}

export interface SubtitleOption {
  label: string;
  index: number;
  language?: string;
}

export interface PlaybackProgressPayload {
  itemId: string;
  mediaSourceId?: string;
  playSessionId?: string;
  positionTicks: number;
  isPaused?: boolean;
  subtitleStreamIndex?: number;
}

export type SubtitleTrack = JellyfinMediaStream;
