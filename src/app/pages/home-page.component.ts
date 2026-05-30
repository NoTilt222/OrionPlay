import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, startWith } from 'rxjs';
import { FeaturedBannerComponent } from '../components/featured-banner.component';
import { MediaCardComponent } from '../components/media-card.component';
import { MediaRowComponent } from '../components/media-row.component';
import { MediaItem } from '../models/media.model';
import { AuthService } from '../services/auth.service';
import { EMPTY_HOME_SECTIONS, MediaService } from '../services/media.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, FeaturedBannerComponent, MediaRowComponent, MediaCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  private readonly auth = inject(AuthService);
  protected readonly media = inject(MediaService);

  protected readonly home$ = this.media.getHomeSections(this.auth.userId).pipe(
    startWith(EMPTY_HOME_SECTIONS),
    catchError(() => of(EMPTY_HOME_SECTIONS))
  );

  protected readonly railArt = (item: MediaItem) => {
    const artwork = this.media.backdropUrl(item, 960) ?? this.media.posterUrl(item, 640);
    return artwork ? `url('${artwork}')` : '';
  };

  protected readonly trackById = (_: number, item: MediaItem) => item.Id;
  protected readonly trackGenre = (_: number, genre: { Id?: string; Name: string }) => genre.Id ?? genre.Name;
}
