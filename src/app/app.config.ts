import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AppConfigService } from './services/app-config.service';
import { jellyfinAuthInterceptor } from './shared/interceptors/jellyfin-auth.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([jellyfinAuthInterceptor])),
    provideAppInitializer(() => inject(AppConfigService).loadConfig())
  ]
};
