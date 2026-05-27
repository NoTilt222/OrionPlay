import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MediaCardComponent } from '../components/media-card.component';
import { AuthService } from '../services/auth.service';
import { MediaService } from '../services/media.service';

@Component({
  selector: 'app-continue-watching-page',
  standalone: true,
  imports: [CommonModule, AsyncPipe, MediaCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './continue-watching-page.component.html',
  styleUrl: './continue-watching-page.component.scss'
})
export class ContinueWatchingPageComponent {
  private readonly auth = inject(AuthService);
  private readonly media = inject(MediaService);

  protected readonly continueWatching$ = this.media.getContinueWatching(this.auth.userId);

  trackById = (_: number, item: { Id: string }) => item.Id;
}
