import { Injectable, inject } from '@angular/core';
import { PlaybackInfoResponse, PlaybackProgressPayload } from '../models/playback.model';
import { AppConfigService } from './app-config.service';
import { AuthService } from './auth.service';
import { JellyfinApiService } from './jellyfin-api.service';

@Injectable({ providedIn: 'root' })
export class PlaybackStateService {
  private readonly api = inject(JellyfinApiService);
  private readonly auth = inject(AuthService);
  private readonly config = inject(AppConfigService);

  getPlaybackInfo(userId: string, itemId: string) {
    return this.api.post<PlaybackInfoResponse>(
      `/Items/${itemId}/PlaybackInfo`,
      {},
      {
        UserId: userId,
        StartTimeTicks: 0,
        AutoOpenLiveStream: true
      }
    );
  }

  createHlsUrl(itemId: string, mediaSourceId?: string, maxStreamingBitrate = 12000000): string {
    const token = this.auth.token || this.config.config.apiKey || '';

    return this.api.buildPublicUrl(`/Videos/${itemId}/master.m3u8`, {
      UserId: this.auth.userId,
      DeviceId: this.config.config.deviceId,
      MediaSourceId: mediaSourceId,
      MaxStreamingBitrate: maxStreamingBitrate,
      api_key: token,
      VideoCodec: 'h264,hevc,av1',
      AudioCodec: 'aac,mp3,ac3,eac3',
      SubtitleMethod: 'Embed',
      TranscodingMaxAudioChannels: 6,
      SegmentContainer: 'ts'
    });
  }

  reportPlaybackStart(itemId: string, mediaSourceId?: string, playSessionId?: string) {
    return this.api.post<void>('/Sessions/Playing', {
      ItemId: itemId,
      MediaSourceId: mediaSourceId,
      PlaySessionId: playSessionId,
      CanSeek: true
    });
  }

  reportProgress(payload: PlaybackProgressPayload) {
    return this.api.post<void>('/Sessions/Playing/Progress', {
      ItemId: payload.itemId,
      MediaSourceId: payload.mediaSourceId,
      PlaySessionId: payload.playSessionId,
      PositionTicks: payload.positionTicks,
      IsPaused: payload.isPaused ?? false,
      SubtitleStreamIndex: payload.subtitleStreamIndex
    });
  }

  reportStopped(payload: PlaybackProgressPayload) {
    return this.api.post<void>('/Sessions/Playing/Stopped', {
      ItemId: payload.itemId,
      MediaSourceId: payload.mediaSourceId,
      PlaySessionId: payload.playSessionId,
      PositionTicks: payload.positionTicks,
      Failed: false
    });
  }
}
