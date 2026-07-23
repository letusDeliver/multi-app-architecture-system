import { Component, computed, inject } from '@angular/core';

import { ShellApiService } from './shell-api.service';

/**
 * The single, shell-exclusive header-actions host (ARCH-2026-06 Decision
 * 009) — the first concrete extension point (ARCH-2026-03 §5): applications
 * never render their own header UI, only call
 * `ShellApiService.registerHeaderAction()`. Entries are read straight off
 * the live registry and sorted by priority; entitlement filtering is
 * intentionally not enforced yet (see Milestone 4 Architecture Validation
 * Report — no real entitlement source exists, mirroring
 * `PlatformManifestService`'s own "always allow" stub).
 */
@Component({
  selector: 'app-header-actions-host',
  template: `
    @for (action of sortedActions(); track action.id) {
      <button type="button" (click)="action.onInvoke()">{{ action.label }}</button>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: 0.5rem;
    }
  `,
})
export class HeaderActionsHostComponent {
  protected readonly shellApi = inject(ShellApiService);

  protected readonly sortedActions = computed(() =>
    [...this.shellApi.headerActions()]
      .map((entry) => entry.contribution)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)),
  );
}
