import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { MediaRowComponent } from '../components/media-row.component';
import { VideoPlayerComponent } from '../components/video-player.component';
import { AuthService } from '../services/auth.service';
import { MediaService } from '../services/media.service';
import { PlaybackStateService } from '../services/playback-state.service';

@Component({
  selector: 'app-player-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, VideoPlayerComponent, MediaRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-page.component.html',
  styleUrl: './player-page.component.scss'
})
export class PlayerPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  protected readonly media = inject(MediaService);
  private readonly playbackState = inject(PlaybackStateService);

  protected readonly vm$ = combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
    map(([params, query]) => ({
      itemId: params.get('id') ?? '',
      resume: query.get('resume') === 'true'
    })),
    switchMap(({ itemId, resume }) =>
      this.media.getDetails(this.auth.userId, itemId).pipe(
        switchMap((item) => {
          const playbackItemId = this.media.playbackTargetId(item);
          const playable = this.media.isPlayable(item);

          return combineLatest([
            of(item),
            playable && playbackItemId
              ? this.playbackState.getPlaybackInfo(this.auth.userId, playbackItemId)
              : of(null),
            this.media.getRecommended(this.auth.userId, itemId)
          ]).pipe(
            map(([resolvedItem, playbackInfo, recommendations]) => ({
              item: resolvedItem,
              playbackInfo,
              recommendations,
              backdrop: this.media.backdropUrl(resolvedItem, 1800),
              playable,
              resume
            }))
          );
        })
      )
    )
  );
}
