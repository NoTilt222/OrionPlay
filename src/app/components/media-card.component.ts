import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaItem } from '../models/media.model';
import { AvailabilityStateService } from '../services/availability-state.service';
import { MediaService } from '../services/media.service';

@Component({
  selector: 'app-media-card',
  standalone: true,
  imports: [NgIf, NgClass, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-card.component.html',
  styleUrl: './media-card.component.scss'
})
export class MediaCardComponent {
  @Input({ required: true }) item!: MediaItem;
  @Input() variant: 'poster' | 'wide' = 'poster';
  @Input() showProgress = false;

  protected readonly media = inject(MediaService);
  protected readonly availabilityState = inject(AvailabilityStateService);

  get artworkStyle(): string {
    const url = this.variant === 'wide'
      ? this.media.backdropUrl(this.item, 960) ?? this.media.posterUrl(this.item, 640)
      : this.media.posterUrl(this.item, 640) ?? this.media.backdropUrl(this.item, 960);
    return url ? `url('${url}')` : '';
  }

  get resumePercent(): number {
    return this.media.resumePercent(this.item);
  }
}
