import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SHELL_API } from '@platform/shell-api-contracts';

import { routes } from './app.routes';
import { ShellApiService } from './platform/shell-api.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Binds the published, application-facing SHELL_API token to the shell's
    // one concrete implementation. Applications inject SHELL_API and never
    // see ShellApiService itself (ARCH-2026-02 §4).
    { provide: SHELL_API, useExisting: ShellApiService },
  ],
};
