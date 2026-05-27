import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { LoadingRowSkeletonComponent } from '../components/loading-row-skeleton.component';
import { MediaCardComponent } from '../components/media-card.component';
import { AuthService } from '../services/auth.service';
import { MediaService } from '../services/media.service';

@Component({
  selector: 'app-library-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, MediaCardComponent, LoadingRowSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './library-page.component.html',
  styleUrl: './library-page.component.scss'
})
export class LibraryPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly media = inject(MediaService);

  protected readonly vm$ = combineLatest([this.route.url, this.route.queryParamMap]).pipe(
    map(([segments, params]) => ({
      type: segments[0]?.path === 'shows' ? 'shows' : 'movies',
      genre: params.get('genre') ?? ''
    })),
    switchMap(({ type, genre }) =>
      (type === 'shows'
        ? this.media.getSeries(this.auth.userId, genre || undefined)
        : this.media.getMovies(this.auth.userId, genre || undefined)
      ).pipe(map((items) => ({ type, genre, items })))
    )
  );

  trackById = (_: number, item: { Id: string }) => item.Id;
}
