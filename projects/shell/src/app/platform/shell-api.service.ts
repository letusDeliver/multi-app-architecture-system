import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ShellPublicApi, Theme, ToastRequest } from '@platform/shell-api-contracts';

export interface ToastEntry extends ToastRequest {
  readonly id: number;
}

const DEFAULT_TOAST_DURATION_MS = 4000;

type CapabilityId = 'toast' | 'theme';

/**
 * The Shell Public API's one concrete implementation (ARCH-2026-03 §3/§4).
 * Every capability is realized as an entry in a private registry populated
 * once at construction — Toast and Theme are its first two entries, not
 * special cases. Every future capability (Notifications, Breadcrumbs,
 * Workspace, Locale, ...) should be added the same way: a registered entry
 * behind a typed public method or Observable, looked up rather than
 * hardcoded, so a call against a capability the shell hasn't registered
 * fails contained and diagnosable instead of throwing into the caller — the
 * Milestone 2 analogue of Milestone 1's unreachable/incompatible-remote
 * handling.
 */
@Injectable({ providedIn: 'root' })
export class ShellApiService implements ShellPublicApi {
  private readonly registry = new Set<CapabilityId>(['toast', 'theme']);

  private nextToastId = 0;
  private readonly _toasts = signal<readonly ToastEntry[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly themeSource = new BehaviorSubject<Theme>({ mode: 'light' });
  readonly theme$: Observable<Theme> = this.themeSource.asObservable();

  showToast(request: ToastRequest): void {
    if (!this.registry.has('toast')) {
      this.reportNotRegistered('toast');
      return;
    }

    const entry: ToastEntry = { ...request, id: this.nextToastId++ };
    this._toasts.update((toasts) => [...toasts, entry]);

    const duration = request.durationMs ?? DEFAULT_TOAST_DURATION_MS;
    setTimeout(() => this.dismissToast(entry.id), duration);
  }

  dismissToast(id: number): void {
    this._toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  /**
   * Shell-internal only — Theme's write side belongs to the shell, never to
   * an application (see the contract's "Nothing — read-only consumer" row).
   * Driven here by the shell's own header toggle.
   */
  setTheme(theme: Theme): void {
    if (!this.registry.has('theme')) {
      this.reportNotRegistered('theme');
      return;
    }
    this.themeSource.next(theme);
  }

  private reportNotRegistered(id: CapabilityId): void {
    console.error(`[shell-api] capability "${id}" is not registered — call ignored`);
  }
}
