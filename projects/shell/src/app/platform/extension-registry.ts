import { signal } from '@angular/core';
import { Disposer } from '@platform/shell-api-contracts';

interface RegisteredContribution<T> {
  readonly ownerAppId: string;
  readonly contribution: T;
}

/**
 * Generic registration-with-lifecycle machinery behind every ARCH-2026-03 §5
 * extension point — Header Actions (Milestone 4) is its first concrete
 * consumer, not a special case baked into this class. A future contribution
 * type (Navigation, Toolbar Actions, Keyboard Shortcuts, Search Providers,
 * ...) is expected to instantiate its own `ExtensionRegistry<TheirType>`
 * rather than requiring any change here — only the contribution's own
 * payload shape and its rendering host differ per type.
 *
 * `id` uniqueness is enforced across the whole registry, deliberately not
 * namespaced-then-checked-per-owner: two different applications registering
 * the same id is exactly the collision ARCH-2026-03 §5 Principle 4 requires
 * be caught, not silently resolved by whichever registered last. `ownerAppId`
 * is recorded separately, for attribution and bulk teardown, never for
 * scoping uniqueness.
 */
export class ExtensionRegistry<T extends { readonly id: string }> {
  private readonly _entries = signal<readonly RegisteredContribution<T>[]>([]);
  readonly entries = this._entries.asReadonly();

  register(ownerAppId: string, contribution: T): Disposer {
    if (this._entries().some((entry) => entry.contribution.id === contribution.id)) {
      console.error(
        `[extension-registry] contribution id "${contribution.id}" is already registered — registration ignored`,
      );
      return () => {};
    }

    this._entries.update((entries) => [...entries, { ownerAppId, contribution }]);

    // Idempotent and safe by construction, not by a flag: removing an id
    // that is no longer present — because it was already disposed, or the
    // owning application was already unmounted via deregisterAll — is just
    // a no-op filter, never an error. This is what makes calling a disposer
    // after its owning application has unloaded safe (Milestone 4).
    return () => {
      this._entries.update((entries) => entries.filter((entry) => entry.contribution.id !== contribution.id));
    };
  }

  /** Called only at Unmount (ARCH-2026-03 §2/§5) — bulk-removes every contribution owned by one application, regardless of how many it registered. */
  deregisterAll(ownerAppId: string): void {
    this._entries.update((entries) => entries.filter((entry) => entry.ownerAppId !== ownerAppId));
  }
}
