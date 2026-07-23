import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Milestone 2 (Shell Public API v0) deliberately ships exactly two
 * capabilities — Toast (application → shell) and Theme (shell → application)
 * — to validate the two base communication patterns from ARCH-2026-03 §3/§4
 * with the smallest possible surface. This package exposes only what an
 * application needs to consume those two capabilities; it must not grow
 * ahead of what an approved milestone actually requires.
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
}

export const SHELL_API = new InjectionToken<ShellPublicApi>('SHELL_API');
