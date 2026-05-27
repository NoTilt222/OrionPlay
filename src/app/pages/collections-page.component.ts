import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { MediaRowComponent } from '../components/media-row.component';
import { AuthService } from '../services/auth.service';
import { MediaService } from '../services/media.service';

@Component({
  selector: 'app-collections-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, MediaRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collections-page.component.html',
  styleUrl: './collections-page.component.scss'
})
export class CollectionsPageComponent {
  private readonly auth = inject(AuthService);
  private readonly media = inject(MediaService);

  protected readonly vm$ = combineLatest([
    this.media.getGenres(this.auth.userId),
    this.media.getRecentlyAdded(this.auth.userId),
    this.media.getTrendingMovies(this.auth.userId)
  ]).pipe(
    map(([genres, recentlyAdded, topRated]) => ({
      genres: genres.slice(0, 10),
      recentlyAdded,
      topRated
    }))
  );
}
