# Architecture Validation Report — Milestone 3 (Shell Public API v0 — Dialogs)

**Date:** 2026-07-23
**Milestone:** M3 — Dialogs (request/response)
**Status:** Complete, all approved acceptance criteria met

---

## Which architectural decisions were successfully validated?

| Decision / section | Validated how |
|---|---|
| **ARCH-2026-03 §4** (Dialogs row — application supplies content + result contract, shell owns focus-trapping, stacking, dismissal, and chrome) | `hello-world-app` calls `openDialog({ title, message, actions })` and awaits the returned Promise; the shell's `DialogHostComponent` renders the title/message/actions, owns Tab-cycling focus trap, initial focus, and Escape/backdrop dismissal — live-verified in a real headless-Chromium session, not just unit tests. |
| **ARCH-2026-03 §3** (Service APIs — application → shell) extended to the **request/response** shape | Milestone 2 proved fire-and-forget (Toast) and read-only-observable (Theme). `openDialog<TResult>()` proves the third shape: a Promise settled by a shell-internal choice (`resolveDialog`), not by the caller. All three base communication shapes named in §3/§4 are now validated. |
| **ARCH-2026-02 §4** (dependency direction) | `hello-world-app` depends only on `@platform/shell-api-contracts`'s `openDialog` signature; grep across `projects/hello-world-app/src` shows zero references to `ShellApiService` or `DialogHostComponent`, and zero dialog-chrome markup of its own. |
| **ARCH-2026-06 Decision 009** (a small shell-exclusive UI tier, reachable only through the Shell Public API) | `DialogHostComponent` is the second shell-exclusive-tier component (after `ToastHostComponent`), confirming the tier generalizes rather than being a one-off. |
| **ARCH-2026-03 §2** (Unmount — an application's contributions must not outlive it) | `RemoteMountComponent.ngOnDestroy` calls `ShellApiService.cancelDialog()`, resolving any open dialog with `undefined` regardless of `dismissible`, so a dialog can never outlive the application that requested it. |
| **ARCH-2026-03 §5 Principle 1** (registration/content, never injection) | `DialogRequest` is a plain-data shape (title, message, a fixed list of label/value actions) — no template, component reference, or handler function crosses the application→shell boundary, the same discipline Toast already established. |

## Which assumptions proved correct?

- Milestone 2's registry-backed capability pattern (`registry.has(id)` guarding a typed public method) generalized to a third, structurally different communication shape without any restructuring — `openDialog` is still "look up the capability, act via shell-owned state," just wrapping that state in a Promise instead of a Signal/Observable.
- A plain-data content descriptor (title + message + typed label/value actions) was sufficient to prove "application supplies content, shell owns chrome" for Dialogs. A generic template/portal-injection mechanism was not needed to validate this milestone's scope, and building one would have contradicted §5 Principle 1 (registration, not injection) rather than served it.
- The Unmount-cancellation design question flagged as a risk before implementation resolved cleanly: a single new method (`cancelDialog`) called from `RemoteMountComponent.ngOnDestroy` was sufficient — no new lifecycle-hook abstraction was needed.

## Which assumptions proved incorrect?

- **Angular's `(keydown.tab)` filtered event binding does not narrow the handler's parameter type to `KeyboardEvent`** — it remains typed as the base `Event`, even though the binding only fires for that key. Milestone 2 had a similarly-shaped build-tooling surprise (the `tsconfig` `include` requirement for Angular-symbol-touching files) but this one was smaller: a local `instanceof KeyboardEvent` narrowing inside `onTab()` resolved it with no config change required.

## Were any ADRs created?

No. The one surprise above was build-tooling type-narrowing behavior, resolved at the code level, and did not require a deviation from ratified architecture.

## Does the implementation still comply with all approved architecture?

Yes.
- No application renders its own dialog chrome — confirmed for `hello-world-app` by grep (no `dialog-backdrop`/`dialog-panel` markup, no reference to `ShellApiService` or `DialogHostComponent` anywhere in its source).
- The application depends only on `@platform/shell-api-contracts` (the `DialogRequest`/`DialogAction` types and the `openDialog` method on `ShellPublicApi`), never on the shell's concrete implementation.
- Extension Points (§5) and the Command Channel/Event Bus (§3) remain untouched — Milestone 3's scope stayed to exactly the one approved capability, Dialogs.

## What technical debt was intentionally accepted?

1. **Only one dialog can be open at a time.** Multi-dialog stacking was named out of scope before implementation began (see the approved Milestone 3 plan) and remains so — `ShellApiService` holds a single `OpenDialog | null`, not a stack.
2. **`DialogHostComponent` has minimal visual design** — a plain backdrop/panel with no animation, sizing variants, or design-system tokens. Same precedent as Milestone 2's `ToastHostComponent`: this milestone proves ownership of the rendering surface and the request/response mechanics, not finished visual design.
3. **Unmount-cancellation is exercised only at the unit-test level** (`fixture.destroy()` on `RemoteMountComponent` while a dialog is open), not via a live multi-application browser scenario — because only one application is currently registered, there is no in-product way to navigate away from `hello-world-app` while it has an open dialog. Named explicitly so it isn't mistaken for the same live-browser coverage the rest of this milestone got.
4. **`@platform/manifest-schema` remains outside both projects' `tsconfig.app.json` `include`** (Milestone 1 debt item 3, still unchanged, still a type-checking warning rather than a build failure).
5. **Nine of the Shell Public API's twelve capabilities remain unbuilt** (Notifications, Breadcrumbs, Document Title, Global Search, Quick Actions, Command Palette, Workspace Switching, Loading Indicators, Progress), and Extension Points (§5) and the Command Channel/Event Bus (§3) are entirely unbuilt. This is the approved scope for Milestone 3, not a gap: the remaining fire-and-forget-shaped capabilities are expected to reuse Toast's pattern directly; Extension Points still need their own milestone to prove the distinct registration-with-lifecycle machinery neither Toast, Theme, nor Dialogs required.

## Is it safe to proceed to the next milestone?

Yes. All three base Shell Public API communication shapes from ARCH-2026-03 §3/§4 — fire-and-forget, read-only live context, and request/response — are now validated end-to-end and live-verified in a real browser (dialog open → focus trap → Tab-cycle → resolve-by-click, plus separately Escape-dismiss and backdrop-dismiss, plus a toast-still-works regression check). The reference application can still be removed without any change to the Shell Public API implementation (interface-only dependency, grep-confirmed). The one remaining structurally distinct mechanism named in the Milestone 2 report — Extension Points' registration-with-lifecycle machinery (§5) — is the clear, explicit candidate for the next milestone.
