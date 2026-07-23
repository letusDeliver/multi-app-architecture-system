# Architecture Validation Report — Milestone 4 (Extension Points v0 — Header Actions)

**Date:** 2026-07-23
**Milestone:** M4 — Extension Points (registration-with-lifecycle), proved via Header Actions
**Status:** Complete, all approved acceptance criteria met

---

## Which architectural decisions were successfully validated?

| Decision / section | Validated how |
|---|---|
| **ARCH-2026-03 §5 Principle 1** (registration, not injection) | `HeaderActionContribution` is a plain-data descriptor (id, label, icon?, priority?, requiredEntitlement?, onInvoke) — no template, component reference, or portal crosses the application→shell boundary; `HeaderActionsHostComponent` owns all rendering. |
| **ARCH-2026-03 §5 Principle 2** (lifecycle-scoped, automatically) | `RemoteMountComponent.ngOnDestroy` calls `ShellApiService.deregisterAllContributions(appId)`, bulk-removing every contribution owned by the unmounted application — live-verified via unit test (`fixture.destroy()` while a header action is registered) since only one reference application exists to navigate away from (same constraint as Milestone 3). |
| **ARCH-2026-03 §5 Principle 3** (entitlement declared at registration) | `requiredEntitlement` is captured on the contribution at registration time. Enforcement is intentionally a stub — see Technical Debt. |
| **ARCH-2026-03 §5 Principle 4** (namespaced to prevent collisions) | Two different owners registering the same `id` is caught and contained (`console.error`, second registration ignored) rather than silently overwritten — `ExtensionRegistry.register` checks the raw id across the whole registry, deliberately not per-owner-namespaced, so the collision itself is what surfaces. |
| **Ownership is shell-attributed, not application-declared** (this milestone's central refinement) | `RemoteMountComponent` overrides the `SHELL_API` DI token per mount with a wrapper it constructs itself (`createScopedShellApi`), closing over the manifest entry's own id before the mounted application's code runs. The application never supplies, sees, or can forge an owner id — proved directly in `remote-mount.component.spec.ts` by having a fake remote component call `inject(SHELL_API).registerHeaderAction(...)` itself and asserting the resulting entry is attributed to the manifest entry's id. |
| **Cleanup robustness — disposer after unload** | `ExtensionRegistry`'s disposer is a filtered removal by id, not a stateful flag — calling it after `deregisterAll` has already removed the entry is a no-op, never a throw. Verified at three layers: the generic registry, `ShellApiService`, and `RemoteMountComponent` (a disposer captured before `fixture.destroy()`, called after). |
| **ARCH-2026-06 Decision 009** (shell-exclusive UI tier) | `HeaderActionsHostComponent` is the third shell-exclusive-tier component (after Toast, Dialog), confirming the tier — and the "shell owns rendering, application owns content" split — generalizes to a fourth communication shape. |
| **ARCH-2026-02 §4** (dependency direction) | `hello-world-app` depends only on `HeaderActionContribution`/`registerHeaderAction` from `@platform/shell-api-contracts`; grep across its source shows zero references to `ShellApiService`, `HeaderActionsHostComponent`, or `ExtensionRegistry`. |

## Which assumptions proved correct?

- The generic/concrete split held exactly as designed: `ExtensionRegistry<T extends {id: string}>` needed zero Header-Action-specific knowledge — `ShellApiService.registerHeaderAction` supplies the one type-specific validation (`label` required) before delegating to the generic `register`/`deregisterAll` machinery. A second contribution type would reuse the class unchanged.
- A per-mount scoped DI override (`Injector.create` overriding `SHELL_API` on the child injector passed to `createComponent`) was sufficient to make ownership attribution airtight, without any mutable "currently active application" global — eliminating an entire class of re-entrancy risk that a global pointer would have introduced. This was a refinement made in response to review, not the original plan, and it produced a structurally stronger guarantee than the plan's own baseline model.
- Idempotent disposal by construction (filter-by-id, no `disposed` flag) fell out of the array-based registry design for free and required no special-casing to satisfy the "safe after unload" requirement.
- Keeping entitlement *declaration* (data on the contribution) separate from entitlement *enforcement* (a no-op stub) let this milestone prove §5 Principle 3's registration-time contract without building an authorization engine — consistent with `PlatformManifestService`'s existing "always allow" precedent from Milestone 1.

## Which assumptions proved incorrect?

None. No build-tooling or type-system surprises this milestone (unlike Milestone 2's `tsconfig` `include` issue or Milestone 3's `(keydown.tab)` typing gap).

## Were any ADRs created?

No. The ownership-scoping design (per-mount DI override rather than a global active-app pointer) was a refinement within already-approved scope, not a deviation from ratified architecture.

## Does the implementation still comply with all approved architecture?

Yes.
- No application renders its own header-action chrome — confirmed for `hello-world-app` by grep (no reference to `ShellApiService`, `HeaderActionsHostComponent`, or `ExtensionRegistry` anywhere in its source).
- The application depends only on `@platform/shell-api-contracts`'s `HeaderActionContribution` type and `registerHeaderAction`/`Disposer` shapes, never on the shell's concrete implementation.
- Every other catalogued extension point (Navigation, Search Providers, Notifications, Keyboard Shortcuts, Context Menus, Status Bar, Command Palette, Global Widgets) remains unbuilt — Milestone 4's scope stayed to exactly the one approved contribution type.
- The Command Channel/Event Bus (ARCH-2026-03 §3) remains untouched.

## What technical debt was intentionally accepted?

1. **Entitlement is declared but not enforced.** `requiredEntitlement` is captured on every contribution and read by nothing yet — there is no current-user/entitlement source in the platform to filter against, the same gap `PlatformManifestService` already named in Milestone 1. `HeaderActionsHostComponent` renders every registered action unconditionally.
2. **Only Header Actions exists as a concrete extension point.** Navigation, Toolbar, Quick Actions, Keyboard Shortcuts, Search Providers, Context Menus, Status Bar, Command Palette, and Global Widgets are all unbuilt. Per the approved proposal, Command Palette and Quick Actions in particular are expected to become an aggregation *view* over existing registries (§5 Principle 5, "register once"), not new registries of their own — this milestone did not build that aggregation, only the one registry it would read from.
3. **Cross-application collision and cross-application Unmount isolation are proved at the unit level only**, not live in a multi-app browser session — because only one real application (`hello-world-app`) is registered in the manifest, the same structural limitation Milestone 3 named for cross-app dialog-cancellation. `shell-api.service.spec.ts` and `extension-registry.spec.ts` cover both scenarios directly (duplicate id from a different owner; `deregisterAll` leaving another owner's entries untouched).
4. **No update-in-place API.** Changing a registered contribution requires the caller to dispose and re-register; this was named explicitly out of scope in the approved proposal, not an oversight.
5. **`HeaderActionsHostComponent` has minimal visual design** — plain buttons, no icon rendering despite the contract declaring an optional `icon`, no overflow/collapse behavior for many actions. Same precedent as Toast's and Dialog's hosts: this milestone proves ownership of the registry and rendering surface, not finished visual design.
6. **`@platform/manifest-schema` remains outside both projects' `tsconfig.app.json` `include`** (Milestone 1 debt item 3, still unchanged).

## Is it safe to proceed to the next milestone?

Yes. The registration-with-lifecycle mechanism from ARCH-2026-03 §5 is now validated end-to-end and live-verified in a real browser: an application registers a header action with no chrome of its own, the shell renders and owns it, invoking it triggers the application's own handler, manual disposal and re-registration both work, and (at the unit level, given the single-reference-application constraint already accepted in Milestone 3) automatic Unmount-deregistration and post-unload disposer safety both hold. Ownership is attributed entirely by the shell via a per-mount DI-scoped wrapper — an application can neither impersonate another application's id, nor obtain a disposer for a contribution it doesn't own, nor mutate one (no mutation API exists). The reference application remains removable without any change to the Shell Public API's implementation (interface-only dependency, grep-confirmed).

As answered in the approved proposal: this registration/ownership/lifecycle mechanism is expected to extend to Navigation, Toolbar Actions, Quick Actions, Keyboard Shortcuts, Search Providers, and Command Palette without redesign — varying only the contribution's payload shape and its rendering host — with Keyboard Shortcuts needing one additive reserved-key guard and Command Palette/Quick Actions expected to read existing registries rather than register anew. Nothing observed during implementation contradicts that expectation.
