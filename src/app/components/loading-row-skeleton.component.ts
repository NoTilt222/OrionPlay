import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-loading-row-skeleton',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-row-skeleton.component.html',
  styleUrl: './loading-row-skeleton.component.scss'
})
export class LoadingRowSkeletonComponent {
  @Input() count = 6;

  get cards() {
    return Array.from({ length: this.count });
  }
}
