import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DialogRequest, ShellPublicApi, Theme, ToastRequest } from '@platform/shell-api-contracts';

export interface ToastEntry extends ToastRequest {
  readonly id: number;
}

/**
 * Internal-only: pairs the requested content with the Promise's own
 * `resolve`. `TResult` is erased to `unknown` here deliberately — the
 * service holds at most one open dialog at a time (multi-dialog stacking is
 * out of scope, see Milestone 3 Architecture Validation Report) and doesn't
 * need to recover the original type; only the caller-side Promise does.
 */
interface OpenDialog {
  readonly request: DialogRequest<unknown>;
  readonly resolve: (value: unknown) => void;
}

const DEFAULT_TOAST_DURATION_MS = 4000;

type CapabilityId = 'toast' | 'theme' | 'dialog';

/**
 * The Shell Public API's one concrete implementation (ARCH-2026-03 §3/§4).
 * Every capability is realized as an entry in a private registry populated
 * once at construction — Toast, Theme, and Dialog are its first three
 * entries, not special cases. Every future capability (Notifications,
 * Breadcrumbs, Workspace, Locale, ...) should be added the same way: a
 * registered entry behind a typed public method or Observable, looked up
 * rather than hardcoded, so a call against a capability the shell hasn't
 * registered fails contained and diagnosable instead of throwing into the
 * caller — the Milestone 2 analogue of Milestone 1's unreachable/
 * incompatible-remote handling. Dialog (Milestone 3) additionally proves the
 * request/response shape: `openDialog` returns a Promise settled by
 * `resolveDialog`/`dismissDialog`/`cancelDialog`, never by the caller directly.
 */
@Injectable({ providedIn: 'root' })
export class ShellApiService implements ShellPublicApi {
  private readonly registry = new Set<CapabilityId>(['toast', 'theme', 'dialog']);

  private nextToastId = 0;
  private readonly _toasts = signal<readonly ToastEntry[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly themeSource = new BehaviorSubject<Theme>({ mode: 'light' });
  readonly theme$: Observable<Theme> = this.themeSource.asObservable();

  private readonly _dialog = signal<OpenDialog | null>(null);
  readonly dialog = this._dialog.asReadonly();

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

  openDialog<TResult>(request: DialogRequest<TResult>): Promise<TResult | undefined> {
    if (!this.registry.has('dialog')) {
      this.reportNotRegistered('dialog');
      return Promise.resolve(undefined);
    }

    return new Promise<TResult | undefined>((resolve) => {
      this._dialog.set({
        request: request as DialogRequest<unknown>,
        resolve: resolve as (value: unknown) => void,
      });
    });
  }

  /** Called only by DialogHostComponent — the one place an open dialog is settled by user choice. */
  resolveDialog(value: unknown): void {
    this._dialog()?.resolve(value);
    this._dialog.set(null);
  }

  /** Called only by DialogHostComponent — Escape/backdrop dismissal. A no-op if `dismissible` is false. */
  dismissDialog(): void {
    const current = this._dialog();
    if (!current || current.request.dismissible === false) {
      return;
    }
    current.resolve(undefined);
    this._dialog.set(null);
  }

  /**
   * Called only by RemoteMountComponent on Unmount (ARCH-2026-03 §2). An
   * open dialog must not outlive the application that requested it — it
   * resolves with `undefined`, the same outcome as a user dismissal,
   * regardless of `dismissible`, since there is no longer a caller to
   * receive any other value.
   */
  cancelDialog(): void {
    this._dialog()?.resolve(undefined);
    this._dialog.set(null);
  }

  private reportNotRegistered(id: CapabilityId): void {
    console.error(`[shell-api] capability "${id}" is not registered — call ignored`);
  }
}
