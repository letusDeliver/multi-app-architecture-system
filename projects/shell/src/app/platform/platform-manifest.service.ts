import { Injectable, signal } from '@angular/core';
import {
  ApplicationManifestEntry,
  ManifestValidationFailure,
  isPlatformManifest,
  validateManifestEntry,
} from '@platform/manifest-schema';

import { environment } from '../../environments/environment';

export type RegisteredApplication = ApplicationManifestEntry;

export interface RegistrationDiagnostic {
  readonly id: string | undefined;
  readonly reason: string;
}

/**
 * Drives Discovery → Registration → Permission Evaluation → Navigation
 * Registration (ARCH-2026-03 §2) for every application in the platform
 * manifest.
 *
 * Permission Evaluation is a stub for Milestone 1 (always allow) — coarse
 * entitlement checking against real identity/workspace is out of scope until
 * auth exists (Milestone 4). This is deliberate and tracked, not an oversight.
 */
@Injectable({ providedIn: 'root' })
export class PlatformManifestService {
  private readonly _registeredApplications = signal<readonly RegisteredApplication[]>([]);
  private readonly _diagnostics = signal<readonly RegistrationDiagnostic[]>([]);
  private readonly _discoveryComplete = signal(false);

  readonly registeredApplications = this._registeredApplications.asReadonly();
  readonly diagnostics = this._diagnostics.asReadonly();
  readonly discoveryComplete = this._discoveryComplete.asReadonly();

  private discoveryPromise: Promise<void> | null = null;

  /**
   * Triggers Discovery exactly once and returns a promise that resolves once
   * it (and Registration/Permission Evaluation) has completed. Callers that
   * only need to react to state as it changes should read the signals above;
   * callers that must not act until the registry is settled — e.g.
   * RemoteMountComponent deciding whether a mountPath is registered — must
   * await this first, since a route can activate concurrently with the
   * shell's own bootstrap, before the manifest fetch resolves.
   */
  ensureDiscovered(): Promise<void> {
    if (!this.discoveryPromise) {
      this.discoveryPromise = this.discover();
    }
    return this.discoveryPromise;
  }

  private async discover(): Promise<void> {
    const diagnostics: RegistrationDiagnostic[] = [];

    let manifestJson: unknown;
    try {
      const response = await fetch(environment.manifestUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      manifestJson = await response.json();
    } catch (err) {
      // The manifest itself being unreachable must never break the shell —
      // it proceeds with zero registered applications, the same end state as
      // an intentionally empty manifest (ARCH-2026-02 §5).
      diagnostics.push({ id: undefined, reason: `manifest discovery failed: ${String(err)}` });
      this._diagnostics.set(diagnostics);
      this._discoveryComplete.set(true);
      return;
    }

    if (!isPlatformManifest(manifestJson)) {
      diagnostics.push({
        id: undefined,
        reason: 'manifest document is malformed (missing "applications" array)',
      });
      this._diagnostics.set(diagnostics);
      this._discoveryComplete.set(true);
      return;
    }

    const registered: RegisteredApplication[] = [];
    for (const candidate of manifestJson.applications) {
      const result = validateManifestEntry(candidate);
      if (result.ok) {
        // Permission Evaluation stub: always allow. Real coarse-entitlement
        // checking is deferred until auth exists (see roadmap Milestone 4).
        registered.push(result.entry);
      } else {
        diagnostics.push({ id: result.id, reason: describeFailure(result.failure) });
        console.error(
          `[platform-manifest] rejected entry${result.id ? ` "${result.id}"` : ''}: ${describeFailure(result.failure)}`,
        );
      }
    }

    this._registeredApplications.set(registered);
    this._diagnostics.set(diagnostics);
    this._discoveryComplete.set(true);
  }

  findByMountPath(mountPath: string): RegisteredApplication | undefined {
    return this._registeredApplications().find((app) => app.mountPath === mountPath);
  }
}

function describeFailure(failure: ManifestValidationFailure): string {
  switch (failure.kind) {
    case 'malformed':
      return `malformed manifest entry: ${failure.reason}`;
    case 'incompatible-contract-version':
      return `incompatible contract version: declared "${failure.declared}", shell supports "${failure.supported}"`;
  }
}
