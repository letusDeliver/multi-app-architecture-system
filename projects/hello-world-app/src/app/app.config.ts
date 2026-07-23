import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SHELL_API, ShellPublicApi } from '@platform/shell-api-contracts';
import { of } from 'rxjs';

import { routes } from './app.routes';

/**
 * Only used when this application is served standalone for local
 * development (`ng serve hello-world-app`) rather than mounted by the shell.
 * In production this application is never bootstrapped this way — the shell
 * mounts it directly via RemoteMountComponent and provides the real
 * ShellApiService — so this stub exists purely so standalone dev serving
 * doesn't crash on a missing DI provider, not as a second implementation of
 * the Shell Public API.
 */
const standaloneShellApiStub: ShellPublicApi = {
  showToast: (request) => console.info(`[standalone dev] toast: ${request.message}`),
  theme$: of({ mode: 'light' }),
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: SHELL_API, useValue: standaloneShellApiStub },
  ],
};
