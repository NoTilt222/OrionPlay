import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MediaCardComponent } from '../components/media-card.component';
import { AuthService } from '../services/auth.service';
import { MediaService } from '../services/media.service';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, MediaCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss'
})
export class FavoritesPageComponent {
  private readonly auth = inject(AuthService);
  private readonly media = inject(MediaService);

  protected readonly favorites$ = this.media.getFavorites(this.auth.userId);

  trackById = (_: number, item: { Id: string }) => item.Id;
}
