import { NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { MediaItem } from '../models/media.model';
import { MediaCardComponent } from './media-card.component';

@Component({
  selector: 'app-media-row',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, MediaCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-row.component.html',
  styleUrl: './media-row.component.scss'
})
export class MediaRowComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) items: MediaItem[] = [];
  @Input() caption = '';
  @Input() emptyMessage = 'Nothing to show yet.';
  @Input() variant: 'poster' | 'wide' = 'poster';
  @Input() showProgress = false;

  @ViewChild('scrollTrack') private scrollTrackRef?: ElementRef<HTMLElement>;

  trackById = (_: number, item: MediaItem) => item.Id;

  scrollNext() {
    const track = this.scrollTrackRef?.nativeElement;

    if (!track) {
      return;
    }

    track.scrollBy({
      left: Math.max(track.clientWidth * 0.82, this.variant === 'wide' ? 380 : 260),
      behavior: 'smooth'
    });
  }
}
