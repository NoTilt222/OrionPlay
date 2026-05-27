import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { MediaRowComponent } from '../components/media-row.component';
import { MediaItem } from '../models/media.model';
import { AuthService } from '../services/auth.service';
import { AvailabilityStateService } from '../services/availability-state.service';
import { MediaService } from '../services/media.service';

@Component({
  selector: 'app-media-details-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, MediaRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-details-page.component.html',
  styleUrl: './media-details-page.component.scss'
})
export class MediaDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly availabilityState = inject(AvailabilityStateService);
  protected readonly media = inject(MediaService);

  protected readonly vm$ = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    switchMap((itemId) =>
      combineLatest([
        this.media.getDetails(this.auth.userId, itemId),
        this.media.getRecommended(this.auth.userId, itemId),
        this.availabilityState.watchlistIds$,
        this.availabilityState.requestedIds$
      ]).pipe(
        map(([item, recommendations, watchlistIds, requestedIds]) => ({
          item,
          recommendations,
          backdrop: this.media.backdropUrl(item),
          poster: this.media.posterUrl(item, 780),
          playable: this.media.isPlayable(item),
          resume: Boolean(item.UserData?.PlaybackPositionTicks),
          trailer: item.Trailers?.[0] ?? null,
          isWatchlisted: watchlistIds.includes(item.Id),
          isRequested: requestedIds.includes(item.Id)
        }))
      )
    )
  );

  toggleFavorite(item: MediaItem, isFavorite: boolean) {
    void this.media.toggleFavorite(this.auth.userId, item, isFavorite).subscribe();
  }

  toggleWatchlist(item: MediaItem) {
    this.availabilityState.toggleWatchlist(item);
  }

  requestTitle(item: MediaItem) {
    this.availabilityState.requestTitle(item);
  }
}
