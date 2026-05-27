import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';

export const jellyfinAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const configService = inject(AppConfigService);
  const serverUrl = configService.serverUrl;

  if (!request.url.startsWith('http') || !serverUrl || !request.url.startsWith(serverUrl)) {
    return next(request);
  }

  const token = authService.token;
  let headers = request.headers
    .set(
      'Authorization',
      authService.getAuthorizationHeader()
    )
    .set('X-Emby-Authorization', authService.getAuthorizationHeader())
    .set('X-Application', `${configService.config.clientName}/${configService.config.appVersion}`);

  if (token) {
    headers = headers
      .set('X-MediaBrowser-Token', token)
      .set('X-Emby-Token', token);
  }

  return next(request.clone({ headers }));
};
