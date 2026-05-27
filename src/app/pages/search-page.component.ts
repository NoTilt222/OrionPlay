import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { MediaCardComponent } from '../components/media-card.component';
import { AuthService } from '../services/auth.service';
import { MediaService } from '../services/media.service';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, MediaCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.scss'
})
export class SearchPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly media = inject(MediaService);

  protected readonly results$ = this.route.queryParamMap.pipe(
    map((params) => (params.get('q') ?? '').trim()),
    debounceTime(150),
    distinctUntilChanged(),
    switchMap((query) =>
      (query ? this.media.search(this.auth.userId, query) : of([])).pipe(
        map((items) => ({ query, items }))
      )
    )
  );

  trackById = (_: number, item: { Id: string }) => item.Id;
}
