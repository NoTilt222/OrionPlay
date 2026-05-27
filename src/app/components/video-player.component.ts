import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import Hls from 'hls.js';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MediaItem } from '../models/media.model';
import { PlaybackInfoResponse, QualityOption } from '../models/playback.model';
import { MediaService } from '../services/media.service';
import { PlaybackStateService } from '../services/playback-state.service';

interface SubtitleTrackOption {
  name?: string;
  lang?: string;
}

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.scss'
})
export class VideoPlayerComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) item!: MediaItem;
  @Input({ required: true }) playbackInfo!: PlaybackInfoResponse;
  @Input() resume = false;

  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  protected readonly media = inject(MediaService);

  private readonly destroyRef = inject(DestroyRef);
  private readonly playbackState = inject(PlaybackStateService);
  private readonly snackBar = inject(MatSnackBar);

  private hls: Hls | null = null;
  private progressInterval: number | null = null;

  protected readonly qualities = signal<QualityOption[]>([]);
  protected readonly subtitleTracks = signal<SubtitleTrackOption[]>([]);
  protected readonly selectedQuality = signal('-1');
  protected readonly selectedSubtitle = signal('-1');

  ngAfterViewInit() {
    this.destroyRef.onDestroy(() => this.disposePlayer(true));
    window.addEventListener('keydown', this.onKeydown);
    this.destroyRef.onDestroy(() => window.removeEventListener('keydown', this.onKeydown));
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['item'] || changes['playbackInfo']) && this.videoRef) {
      queueMicrotask(() => this.initializePlayer());
    }
  }

  setQuality(value: string) {
    this.selectedQuality.set(value);
    if (!this.hls) {
      return;
    }

    this.hls.currentLevel = Number(value);
  }

  setSubtitle(value: string) {
    this.selectedSubtitle.set(value);
    const video = this.videoRef.nativeElement;
    const numericValue = Number(value);

    for (let index = 0; index < video.textTracks.length; index += 1) {
      video.textTracks[index].mode = index === numericValue ? 'showing' : 'disabled';
    }
  }

  async toggleFullscreen() {
    const video = this.videoRef.nativeElement;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await video.requestFullscreen();
  }

  private initializePlayer() {
    this.disposePlayer(false);

    const video = this.videoRef.nativeElement;
    const mediaSource = this.playbackInfo.MediaSources?.[0];
    const playbackItemId = this.media.playbackTargetId(this.item);

    if (!playbackItemId) {
      return;
    }

    const hlsUrl = this.playbackState.createHlsUrl(playbackItemId, mediaSource?.Id);

    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        backBufferLength: 30
      });
      this.hls.loadSource(hlsUrl);
      this.hls.attachMedia(video);

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.qualities.set(
          this.hls?.levels.map((level, index) => ({
            label: `${level.height || 'Auto'}p`,
            value: index
          })) ?? []
        );
        void video.play();
      });

      this.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        this.subtitleTracks.set(
          data.subtitleTracks.map((track) => ({
            name: track.name,
            lang: track.lang
          }))
        );
      });
    } else {
      video.src = hlsUrl;
      void video.play();
    }

    if (this.resume && this.item.UserData?.PlaybackPositionTicks) {
      video.currentTime = this.item.UserData.PlaybackPositionTicks / 10_000_000;
    }

    void this.playbackState
      .reportPlaybackStart(playbackItemId, mediaSource?.Id, this.playbackInfo.PlaySessionId)
      .subscribe();

    this.progressInterval = window.setInterval(() => {
      const positionTicks = Math.floor(video.currentTime * 10_000_000);
      void this.playbackState
        .reportProgress({
          itemId: playbackItemId,
          mediaSourceId: mediaSource?.Id,
          playSessionId: this.playbackInfo.PlaySessionId,
          positionTicks,
          isPaused: video.paused
        })
        .subscribe();
    }, 15000);

    video.addEventListener(
      'error',
      () => {
        this.snackBar.open(
          'This title could not start playing right now. Please try again in a moment.',
          'Dismiss',
          { panelClass: ['orionplay-snackbar'] }
        );
      },
      { once: true }
    );
  }

  private disposePlayer(reportStopped: boolean) {
    const video = this.videoRef?.nativeElement;
    const mediaSource = this.playbackInfo?.MediaSources?.[0];
    const playbackItemId = this.media.playbackTargetId(this.item);

    if (this.progressInterval) {
      window.clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    if (reportStopped && video && this.item && playbackItemId) {
      const positionTicks = Math.floor(video.currentTime * 10_000_000);
      void this.playbackState
        .reportStopped({
          itemId: playbackItemId,
          mediaSourceId: mediaSource?.Id,
          playSessionId: this.playbackInfo?.PlaySessionId,
          positionTicks
        })
        .subscribe();
    }

    this.hls?.destroy();
    this.hls = null;
  }

  private readonly onKeydown = (event: KeyboardEvent) => {
    const video = this.videoRef?.nativeElement;
    const target = event.target as HTMLElement | null;

    if (
      !video ||
      !this.media.isPlayable(this.item) ||
      (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case ' ':
        event.preventDefault();
        video.paused ? void video.play() : video.pause();
        break;
      case 'f':
        void this.toggleFullscreen();
        break;
      case 'm':
        video.muted = !video.muted;
        break;
      case 'arrowright':
      case 'mediafastforward':
      case 'browserforward':
        event.preventDefault();
        video.currentTime = Math.min(video.duration || Number.MAX_SAFE_INTEGER, video.currentTime + 10);
        break;
      case 'arrowleft':
      case 'mediarewind':
      case 'browserback':
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      default:
        break;
    }
  };
}
