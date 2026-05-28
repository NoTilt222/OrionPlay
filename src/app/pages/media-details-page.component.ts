import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { combineLatest, finalize, map, switchMap } from 'rxjs';
import { MediaRowComponent } from '../components/media-row.component';
import { MediaItem } from '../models/media.model';
import { AuthService } from '../services/auth.service';
import { AvailabilityStateService } from '../services/availability-state.service';
import { MediaService } from '../services/media.service';
import { MovieRequestService } from '../services/movie-request.service';

@Component({
  selector: 'app-media-details-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, MediaRowComponent, MatSnackBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-details-page.component.html',
  styleUrl: './media-details-page.component.scss'
})
export class MediaDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly availabilityState = inject(AvailabilityStateService);
  protected readonly movieRequests = inject(MovieRequestService);
  protected readonly media = inject(MediaService);
  protected readonly requestLoadingId = signal('');

  protected readonly vm$ = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    switchMap((itemId) =>
      combineLatest([
        this.media.getDetails(this.auth.userId, itemId),
        this.media.getRecommended(this.auth.userId, itemId),
        this.availabilityState.watchlistIds$,
        this.movieRequests.requestedKeys$
      ]).pipe(
        map(([item, recommendations, watchlistIds]) => ({
          item,
          recommendations,
          backdrop: this.media.backdropUrl(item),
          poster: this.media.posterUrl(item, 780),
          playable: this.media.isPlayable(item),
          resume: Boolean(item.UserData?.PlaybackPositionTicks),
          trailer: item.Trailers?.[0] ?? null,
          isWatchlisted: watchlistIds.includes(item.Id),
          canRequestMovie: this.movieRequests.canRequest(item),
          isRequestSent: this.movieRequests.isRequested(item)
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
    if (!this.movieRequests.canRequest(item)) {
      this.snackBar.open('This title cannot be requested right now.', 'Dismiss', {
        panelClass: ['orionplay-snackbar']
      });
      return;
    }

    if (this.auth.isGuest()) {
      const prompt = this.snackBar.open('Sign in with your own account to request movies.', 'Sign In', {
        panelClass: ['orionplay-snackbar']
      });

      prompt.onAction().subscribe(() => this.auth.logout());
      return;
    }

    if (this.movieRequests.isRequested(item)) {
      this.snackBar.open('This movie was already requested in your current session.', 'Dismiss', {
        panelClass: ['orionplay-snackbar']
      });
      return;
    }

    this.requestLoadingId.set(item.Id);
    this.movieRequests
      .requestMovie(item, globalThis.location?.href ?? '')
      .pipe(finalize(() => this.requestLoadingId.set('')))
      .subscribe({
        next: () =>
          this.snackBar.open('Request sent. We will review it soon.', 'Dismiss', {
            panelClass: ['orionplay-snackbar']
          }),
        error: (error: Error) =>
          this.snackBar.open(error.message, 'Dismiss', {
            panelClass: ['orionplay-snackbar']
          })
      });
  }
}
