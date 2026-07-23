import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';

import { ShellApiService } from './shell-api.service';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The single, shell-exclusive dialog host (ARCH-2026-06 Decision 009) —
 * applications never render their own modal chrome, only call
 * ShellApiService.openDialog(). Owns the outer chrome (backdrop, panel),
 * initial focus, Tab-cycling focus trap, and Escape/backdrop dismissal —
 * the concrete implementation of ARCH-2026-03 §4's Dialogs row. Stacking
 * beyond one dialog at a time is out of scope (see Milestone 3 Architecture
 * Validation Report).
 */
@Component({
  selector: 'app-dialog-host',
  template: `
    @if (shellApi.dialog(); as dialog) {
      <div class="dialog-backdrop" (click)="shellApi.dismissDialog()">
        <div
          #panel
          class="dialog-panel"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="dialog.request.title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
          (keydown.escape)="shellApi.dismissDialog()"
          (keydown.tab)="onTab($event)"
        >
          <h2>{{ dialog.request.title }}</h2>
          <p>{{ dialog.request.message }}</p>
          <div class="dialog-actions">
            @for (action of dialog.request.actions; track action.label) {
              <button
                type="button"
                [attr.data-variant]="action.variant ?? 'secondary'"
                (click)="shellApi.resolveDialog(action.value)"
              >
                {{ action.label }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgb(0 0 0 / 0.4);
    }
    .dialog-panel {
      background: canvas;
      color: canvastext;
      padding: 1.5rem;
      border-radius: 4px;
      min-width: 20rem;
      max-width: 32rem;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }
  `,
})
export class DialogHostComponent {
  protected readonly shellApi = inject(ShellApiService);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    // Runs whenever `panel` transitions from absent to present — i.e. each
    // time a dialog opens — giving it initial focus as §4's chrome owner must.
    effect(() => this.panel()?.nativeElement.focus());
  }

  protected onTab(event: Event): void {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    const panelEl = this.panel()?.nativeElement;
    if (!panelEl) {
      return;
    }

    const focusable = panelEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
