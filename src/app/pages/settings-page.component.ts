import { CommonModule, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent {
  protected readonly auth = inject(AuthService);

  get avatarStyle(): string {
    const avatar = this.auth.profileImageUrl(this.auth.user());
    return avatar ? `url('${avatar}')` : '';
  }
}
