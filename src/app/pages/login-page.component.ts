import { CommonModule, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, finalize, of } from 'rxjs';
import { JellyfinUser } from '../models/auth.model';
import { MediaItem } from '../models/media.model';
import { MOCK_LOGIN_POSTERS } from '../shared/mock-catalog';
import { AppConfigService } from '../services/app-config.service';
import { AuthService } from '../services/auth.service';
import { MediaService } from '../services/media.service';
import { TmdbApiService } from '../services/tmdb-api.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, NgClass, ReactiveFormsModule, MatSnackBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly tmdb = inject(TmdbApiService);
  protected readonly config = inject(AppConfigService).config;
  protected readonly media = inject(MediaService);

  protected readonly loading = signal(false);
  protected readonly guestLoading = signal(false);
  protected readonly accountLoading = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly showCreatePassword = signal(false);
  protected readonly publicUsers = signal<JellyfinUser[]>([]);
  protected readonly selectedPublicUserId = signal('');
  protected readonly createAccountOpen = signal(false);
  protected readonly showcasePosters = signal<MediaItem[]>(MOCK_LOGIN_POSTERS);

  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [true]
  });

  protected readonly createAccountForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    confirmPassword: ['', [Validators.required]]
  });

  constructor() {
    this.auth.discoverPublicUsers().subscribe((users) => {
      this.publicUsers.set(users);
      this.selectedPublicUserId.set(users[0]?.Id ?? '');
    });

    if (this.tmdb.isConfigured()) {
      this.tmdb
        .getTrending(8)
        .pipe(catchError(() => of(MOCK_LOGIN_POSTERS)))
        .subscribe((items) => this.showcasePosters.set(items.length ? items : MOCK_LOGIN_POSTERS));
    }
  }

  posterArt(item: MediaItem): string {
    const artwork = this.media.posterUrl(item, 780) ?? item.MockPosterUrl;
    return artwork ? `url('${artwork}')` : '';
  }

  profileAvatarStyle(user: JellyfinUser): string {
    const avatar = this.auth.profileImageUrl(user);
    return avatar ? `url('${avatar}')` : '';
  }

  selectPublicUser(user: JellyfinUser) {
    this.selectedPublicUserId.set(user.Id);
    this.form.patchValue({ username: user.Name });
  }

  togglePasswordVisibility() {
    this.showPassword.update((current) => !current);
  }

  toggleCreatePasswordVisibility() {
    this.showCreatePassword.update((current) => !current);
  }

  openCreateAccount() {
    this.createAccountForm.reset({
      username: '',
      password: '',
      confirmPassword: ''
    });
    this.createAccountOpen.set(true);
  }

  closeCreateAccount() {
    this.createAccountOpen.set(false);
  }

  browseAsGuest() {
    const guest =
      this.publicUsers().find((user) => user.Id === this.selectedPublicUserId()) ??
      this.publicUsers()[0];

    if (!guest) {
      this.snackBar.open('No public profile is available for guest access right now.', 'Dismiss', {
        panelClass: ['orionplay-snackbar']
      });
      return;
    }

    this.guestLoading.set(true);
    this.auth
      .loginAsGuest(guest, true)
      .pipe(finalize(() => this.guestLoading.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/home']),
        error: () =>
          this.snackBar.open(
            'Guest browsing needs a public profile with no password set in Jellyfin.',
            'Dismiss',
            { panelClass: ['orionplay-snackbar'] }
          )
      });
  }

  submitCreateAccount() {
    if (this.createAccountForm.invalid) {
      return;
    }

    const { username, password, confirmPassword } = this.createAccountForm.getRawValue();

    if (password !== confirmPassword) {
      this.snackBar.open('Passwords do not match yet. Please check them and try again.', 'Dismiss', {
        panelClass: ['orionplay-snackbar']
      });
      return;
    }

    if (!this.config.serverUrl || !this.config.apiKey?.trim()) {
      this.snackBar.open(
        'Account creation needs an admin Jellyfin API token in your app configuration.',
        'Dismiss',
        { panelClass: ['orionplay-snackbar'] }
      );
      return;
    }

    this.accountLoading.set(true);
    this.auth
      .createAccount(username.trim(), password)
      .pipe(
        finalize(() => this.accountLoading.set(false))
      )
      .subscribe({
        next: () => {
          this.closeCreateAccount();
          this.form.patchValue({
            username: username.trim(),
            password,
            remember: true
          });
          this.submit();
        },
        error: (error: { status?: number }) => {
          const message =
            error?.status === 403
              ? 'Your configured Jellyfin token can sign in, but it cannot create users.'
              : error?.status === 409
                ? 'That username already exists on this Jellyfin server.'
                : 'We could not create that account right now. Please try again in a moment.';

          this.snackBar.open(message, 'Dismiss', {
            panelClass: ['orionplay-snackbar']
          });
        }
      });
  }

  submit() {
    if (this.form.invalid || !this.config.serverUrl) {
      this.snackBar.open('OrionPlay is not ready yet. Please try again in a moment.', 'Dismiss', {
        panelClass: ['orionplay-snackbar']
      });
      return;
    }

    const { username, password, remember } = this.form.getRawValue();
    this.loading.set(true);

    this.auth
      .login(username, password, remember)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/home']),
        error: () =>
          this.snackBar.open('We could not sign you in. Check your details and try again.', 'Dismiss', {
            panelClass: ['orionplay-snackbar']
          })
      });
  }
}
