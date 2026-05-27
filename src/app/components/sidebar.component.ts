import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);

  protected readonly navItems = [
    { label: 'Home', icon: 'grid_view', link: '/home' },
    { label: 'Movies', icon: 'local_movies', link: '/movies' },
    { label: 'TV Shows', icon: 'live_tv', link: '/shows' },
    { label: 'My List', icon: 'bookmark_border', link: '/my-list' },
    { label: 'Continue Watching', icon: 'schedule', link: '/continue-watching' },
    { label: 'Collections', icon: 'library_books', link: '/collections' },
    { label: 'Settings', icon: 'tune', link: '/settings' }
  ];

  get avatarStyle(): string {
    const avatar = this.auth.profileImageUrl(this.auth.user());
    return avatar ? `url('${avatar}')` : '';
  }
}
