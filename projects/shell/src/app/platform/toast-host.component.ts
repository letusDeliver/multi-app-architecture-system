import { Component, inject } from '@angular/core';

import { ShellApiService } from './shell-api.service';

/**
 * The single, shell-exclusive toast host (ARCH-2026-06 Decision 005) —
 * applications never render their own toast UI, only call
 * ShellApiService.showToast(). Deliberately unstyled beyond a plain list:
 * Milestone 2 validates that the shell owns this rendering surface, not the
 * surface's visual design — stacking, positioning, and animation are later
 * milestones (design-system tiers), not this one.
 */
@Component({
  selector: 'app-toast-host',
  template: `
    <ul role="status" aria-label="Notifications">
      @for (toast of shellApi.toasts(); track toast.id) {
        <li [attr.data-severity]="toast.severity">{{ toast.message }}</li>
      }
    </ul>
  `,
})
export class ToastHostComponent {
  protected readonly shellApi = inject(ShellApiService);
}
