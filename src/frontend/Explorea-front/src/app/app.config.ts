import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { apiUrlInterceptor } from './core/interceptors/api-url-interceptor';
import { AdminUiPreferencesService } from './features/admin/core/services/admin-ui-preferences.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiUrlInterceptor, authInterceptor])),
    provideTranslateService({ fallbackLang: 'sr' }),
    provideTranslateHttpLoader({
      prefix: '/assets/i18n/',
      suffix: '.json',
    }),
    provideAppInitializer(() => inject(AdminUiPreferencesService).initialize()),
  ],
};
