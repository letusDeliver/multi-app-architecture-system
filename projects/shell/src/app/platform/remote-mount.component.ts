import { Component, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';

import { PlatformManifestService } from './platform-manifest.service';

type MountState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'not-registered'; readonly mountPath: string }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'mounted' };

/**
 * Drives Initialization → Mount → Unmount (ARCH-2026-03 §2) for exactly one
 * registered application, addressed by its mountPath route segment.
 *
 * A failure here — the remote is unreachable, or it loaded but doesn't
 * conform to the mount contract (no "Component" export) — is contained to
 * this component's own state. It must never propagate to the shell chrome
 * or to any other mounted application (Milestone 1 resilience criterion).
 * The UI deliberately does not distinguish "unreachable" from "non-
 * conforming" — both surface as one calm, contained "unavailable" state per
 * ARCH-2026-05 §6's error-state philosophy — but the underlying `reason` is
 * preserved for diagnostics/console.
 */
@Component({
  selector: 'app-remote-mount',
  template: `
    @switch (state().kind) {
      @case ('loading') {
        <p>Loading application…</p>
      }
      @case ('not-registered') {
        <p role="alert">No application is registered at this address.</p>
      }
      @case ('unavailable') {
        <p role="alert">This application is currently unavailable.</p>
      }
    }
    <ng-container #mountPoint></ng-container>
  `,
})
export class RemoteMountComponent implements OnInit, OnDestroy {
  @ViewChild('mountPoint', { read: ViewContainerRef, static: true })
  private mountPoint!: ViewContainerRef;

  private readonly route = inject(ActivatedRoute);
  private readonly manifest = inject(PlatformManifestService);

  protected readonly state = signal<MountState>({ kind: 'loading' });

  async ngOnInit(): Promise<void> {
    // A route can activate concurrently with the shell's own bootstrap (e.g.
    // a direct navigation/deep link), before Discovery has resolved — this
    // must be awaited before checking the registry, or a genuinely
    // registered application would be misreported as unregistered.
    await this.manifest.ensureDiscovered();

    const mountPath = this.route.snapshot.paramMap.get('mountPath') ?? '';
    const entry = this.manifest.findByMountPath(mountPath);

    if (!entry) {
      this.state.set({ kind: 'not-registered', mountPath });
      return;
    }

    let remoteModule: Record<string, unknown>;
    try {
      remoteModule = await loadRemoteModule({
        remoteEntry: entry.remoteEntryUrl,
        exposedModule: './Component',
      });
    } catch (err) {
      console.error(`[remote-mount] failed to load "${entry.id}": ${String(err)}`);
      this.state.set({ kind: 'unavailable', reason: String(err) });
      return;
    }

    const componentType = remoteModule['Component'] as Type<unknown> | undefined;
    if (!componentType) {
      const reason = `remote "${entry.id}" did not expose a "Component" export`;
      console.error(`[remote-mount] ${reason}`);
      this.state.set({ kind: 'unavailable', reason });
      return;
    }

    this.mountPoint.clear();
    this.mountPoint.createComponent(componentType);
    this.state.set({ kind: 'mounted' });
  }

  ngOnDestroy(): void {
    // Unmount (ARCH-2026-03 §2). Full Disposal — releasing the fetched ES
    // module from memory entirely — isn't attempted: browsers have no API to
    // unload an already-imported module, so this is accepted scope, not an
    // oversight (see Milestone 1 Architecture Validation Report).
    this.mountPoint?.clear();
  }
}
