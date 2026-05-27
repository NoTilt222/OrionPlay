import { Routes } from '@angular/router';
import { ShellLayoutComponent } from './components/shell-layout.component';
import { CollectionsPageComponent } from './pages/collections-page.component';
import { ContinueWatchingPageComponent } from './pages/continue-watching-page.component';
import { FavoritesPageComponent } from './pages/favorites-page.component';
import { HomePageComponent } from './pages/home-page.component';
import { LibraryPageComponent } from './pages/library-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { MediaDetailsPageComponent } from './pages/media-details-page.component';
import { PlayerPageComponent } from './pages/player-page.component';
import { SearchPageComponent } from './pages/search-page.component';
import { SettingsPageComponent } from './pages/settings-page.component';
import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: '',
    component: ShellLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', component: HomePageComponent },
      { path: 'movies', component: LibraryPageComponent },
      { path: 'shows', component: LibraryPageComponent },
      { path: 'my-list', component: FavoritesPageComponent },
      { path: 'favorites', pathMatch: 'full', redirectTo: 'my-list' },
      { path: 'continue-watching', component: ContinueWatchingPageComponent },
      { path: 'collections', component: CollectionsPageComponent },
      { path: 'settings', component: SettingsPageComponent },
      { path: 'media/:id', component: MediaDetailsPageComponent },
      { path: 'player/:id', component: PlayerPageComponent },
      { path: 'search', component: SearchPageComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
