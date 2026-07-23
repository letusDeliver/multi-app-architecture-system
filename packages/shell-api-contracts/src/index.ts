import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Milestone 2 (Shell Public API v0) shipped exactly two capabilities —
 * Toast (application → shell, fire-and-forget) and Theme (shell →
 * application, read-only live context) — to validate those two base
 * communication patterns from ARCH-2026-03 §3/§4 with the smallest possible
 * surface. Milestone 3 adds Dialogs to validate the third: request/response.
 * This package must not grow ahead of what an approved milestone requires.
 */

export type ToastSeverity = 'info' | 'success' | 'warning' | 'error';

export interface ToastRequest {
  readonly message: string;
  readonly severity: ToastSeverity;
  /** Defaults to the shell's own value when omitted. */
  readonly durationMs?: number;
}

export interface Theme {
  readonly mode: 'light' | 'dark';
}

/**
 * One button the shell renders in its dialog chrome. `value` is what
 * {@link ShellPublicApi.openDialog} resolves with when this action is
 * chosen — a data descriptor, never a handler reference, per the "content
 * or intent only" rule (ARCH-2026-03 §4): the application decides the set
 * of outcomes, the shell owns rendering and wiring the click.
 */
export interface DialogAction<TResult> {
  readonly label: string;
  readonly value: TResult;
  readonly variant?: 'primary' | 'secondary';
}

/**
 * A dialog's content and result contract. Deliberately a plain-data shape —
 * title, message, and a fixed set of actions — not an arbitrary
 * template/portal: proving the request/response communication pattern is
 * this milestone's scope, not building a generic content-injection
 * mechanism (see Milestone 3 Architecture Validation Report, technical debt).
 */
export interface DialogRequest<TResult> {
  readonly title: string;
  readonly message: string;
  readonly actions: readonly DialogAction<TResult>[];
  /** Whether Escape/backdrop-click resolves the dialog with `undefined`. Defaults to true. */
  readonly dismissible?: boolean;
}

/**
 * The application-facing surface of the Shell Public API. An application may
 * only depend on this interface and the {@link SHELL_API} token — never on
 * the shell's concrete implementation — so the shell's implementation can
 * change freely and the reference application can be removed without any
 * change here (ARCH-2026-02 §4).
 */
export interface ShellPublicApi {
  /** Fire-and-forget: shell owns rendering, no response is returned. */
  showToast(request: ToastRequest): void;

  /** Read-only live context (ARCH-2026-06 Decision 004): shell owns the write side. */
  readonly theme$: Observable<Theme>;

  /**
   * Request/response: shell owns the modal chrome and resolves the returned
   * Promise with the chosen action's `value`, or `undefined` if dismissed
   * (or if the requesting application is unmounted while the dialog is open).
   */
  openDialog<TResult>(request: DialogRequest<TResult>): Promise<TResult | undefined>;
}

export const SHELL_API = new InjectionToken<ShellPublicApi>('SHELL_API');
