import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, FormsModule, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell-layout.component.html',
  styleUrl: './shell-layout.component.scss'
})
export class ShellLayoutComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected searchTerm = '';

  get avatarStyle(): string {
    const avatar = this.auth.profileImageUrl(this.auth.user());
    return avatar ? `url('${avatar}')` : '';
  }

  search() {
    if (!this.searchTerm.trim()) {
      return;
    }

    void this.router.navigate(['/search'], {
      queryParams: { q: this.searchTerm.trim() }
    });
  }
}
