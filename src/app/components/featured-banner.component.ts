import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MediaItem } from '../models/media.model';
import { MediaService } from '../services/media.service';

@Component({
  selector: 'app-featured-banner',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './featured-banner.component.html',
  styleUrl: './featured-banner.component.scss'
})
export class FeaturedBannerComponent implements OnChanges, OnDestroy {
  @Input() items: MediaItem[] = [];

  protected readonly media = inject(MediaService);
  protected readonly activeIndex = signal(0);
  private rotationTimer: number | null = null;

  get activeItem(): MediaItem | null {
    return this.items[this.activeIndex()] ?? null;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['items']) {
      this.activeIndex.set(0);
      this.startRotation();
    }
  }

  ngOnDestroy() {
    this.stopRotation();
  }

  setActive(index: number) {
    this.activeIndex.set(index);
    this.startRotation();
  }

  trackById = (_: number, item: MediaItem) => item.Id;

  backgroundStyle(item: MediaItem): string {
    const backdrop = this.media.backdropUrl(item, 1800) ?? this.media.posterUrl(item, 900);
    return backdrop ? `url('${backdrop}')` : '';
  }

  private startRotation() {
    this.stopRotation();

    if (this.items.length < 2) {
      return;
    }

    this.rotationTimer = window.setInterval(() => {
      this.activeIndex.update((current) => (current + 1) % this.items.length);
    }, 8000);
  }

  private stopRotation() {
    if (this.rotationTimer) {
      window.clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }
}
