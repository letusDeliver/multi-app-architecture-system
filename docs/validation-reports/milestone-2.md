# Architecture Validation Report — Milestone 2 (Shell Public API v0)

**Date:** 2026-07-23
**Milestone:** M2 — Shell Public API v0 (Toast + Theme)
**Status:** Complete, all approved acceptance criteria met

---

## Which architectural decisions were successfully validated?

| Decision / section | Validated how |
|---|---|
| **ARCH-2026-03 §3** (Service APIs — application → shell, one-directional, always permitted) | `hello-world-app` injects `SHELL_API` (never a shell implementation class) and calls `showToast()`; verified live that the call renders in the shell's own toast host with zero rendering code in the application. |
| **ARCH-2026-03 §4** (Shell Public API — shell owns the rendering surface/interaction chrome, application supplies only content or intent) | Toast: application supplies `{ message, severity, durationMs? }`, shell owns queuing, rendering, and auto-dismissal. Theme: application is a read-only consumer of `theme$`, shell owns the write side (`ShellApiService.setTheme`, driven only by the shell's own header toggle). |
| **ARCH-2026-06 Decision 003** (contracts split by concern, published/versioned, never resolved via federation or a submodule) | A second contracts package, `@platform/shell-api-contracts`, added alongside `@platform/manifest-schema` as a bun workspace package — confirming "split by concern" generalizes rather than being a one-off. |
| **ARCH-2026-06 Decision 004** (shell-owned live context exposed as `Observable`, never a Signal, at the boundary) | `theme$: Observable<Theme>` is the read side of a private, shell-held `BehaviorSubject`; the application never receives a Signal and never writes to it. |
| **ARCH-2026-06 Decision 005** (a small shell-exclusive UI tier, reachable only through the Shell Public API) | The toast host is the first implemented shell-exclusive-tier component; `hello-world-app` renders no toast markup of its own anywhere in its source. |
| **ARCH-2026-02 §4** (dependency direction) | `ShellApiService` (the concrete implementation) contains zero references to `hello-world-app`; confirmed by grep across `projects/shell/src` and `packages/shell-api-contracts`. The application depends only on the published `@platform/shell-api-contracts` package. |

## Which assumptions proved correct?

- The Service API direction and the live-context direction are genuinely the same underlying shape — *a typed, app-facing member backed by a shell-internal registry lookup* — confirming Theme needed no special-casing relative to Toast; it is simply the read-only variant of the same pattern.
- Native Federation's `shareAll({ singleton: true })` treats a bun workspace package the same as a real npm dependency: `@platform/shell-api-contracts` was emitted as its own shared singleton chunk in both projects' import maps, giving the `SHELL_API` `InjectionToken` genuine reference identity across the federation boundary — this was verified by inspecting each build's `importmap.json`, not assumed.
- A registry-backed "not registered" fault can be tested meaningfully without any live network condition, fixture file, or additional test-only public API — reaching into the service's private registry from a unit test (and documenting why) was sufficient, since the fault is a defensive code path, not a wire condition like Milestone 1's unreachable/incompatible remotes.

## Which assumptions proved incorrect?

- **A file that imports `@angular/core` cannot be part of Native Federation's shared-package bundling unless it is included in the consuming project's TypeScript program.** Milestone 1 accepted `@platform/manifest-schema` being outside `tsconfig.app.json`'s `include` as a type-checking-only compromise (a warning). For `@platform/shell-api-contracts`, which uses `InjectionToken` from `@angular/core`, the same omission was a hard build failure ("File ... not found in TypeScript compilation"), not just a warning — the angular-compiler plugin apparently requires any file touching Angular symbols to be part of a TS program it was given, regardless of whether the file contains decorators. Fixed by adding the package to both projects' `tsconfig.app.json` `include`, with an explicit `rootDir` (`../..`) to avoid the `rootDir` inference failure Milestone 1 hit and reverted on the same class of change. This time the fix held cleanly — worth noting because it reopens debt item 3 from the Milestone 1 report (manifest-schema still isn't included, and is a plain-warning, not an error, so it was left as is).

## Were any ADRs created?

No. Both surprises above were build-tooling behavior, resolved at the config level, and did not require a deviation from ratified architecture.

## Does the implementation still comply with all approved architecture?

Yes.
- No application renders its own version of a Shell Public API capability — confirmed for Toast (no markup in `hello-world-app`) and Theme (application never writes, only subscribes).
- The application depends only on `@platform/shell-api-contracts` (interface + `InjectionToken`), never on `ShellApiService` — confirmed by the removability check below.
- Extension Points (§5) and the Command Channel/Event Bus (§3) were not touched or partially built — Milestone 2's scope stayed to exactly the two approved capabilities.

## What technical debt was intentionally accepted?

1. **Only two of the Shell Public API's twelve capabilities are implemented** (Toast, Theme). This is the approved scope, not a gap — Notifications, Breadcrumbs, Document Title, Loading Indicators, and Progress are expected to reuse this milestone's fire-and-forget pattern directly in a future milestone; Dialogs will need a request/response variant of the same direction; Quick Actions/Header Actions/Global Search/Command Palette need the distinct Extension Points (§5) registration-with-lifecycle machinery, not this milestone's registry.
2. **The toast host has no stacking, positioning, or animation.** Deliberately out of scope per this milestone's refinement — the rendering surface exists to prove ownership, not to be a finished design-system component.
3. **The "not registered" fault is only exercised at the unit-test level**, by reaching into `ShellApiService`'s private registry, not via a live/build-level fault fixture the way Milestone 1's fault manifest worked. This is appropriate given the fault is a defensive code path rather than a real network condition, but is named here so it isn't mistaken for parity with Milestone 1's live fault coverage.
4. **`@platform/manifest-schema` remains outside both projects' `tsconfig.app.json` `include`** (Milestone 1 debt item 3, unchanged) — it still only produces a type-checking warning, not a build failure, so it was left as is while fixing the equivalent problem for `shell-api-contracts` (which did fail the build).

## Is it safe to proceed to the next milestone?

Yes. Both approved capabilities work end-to-end, live-verified in a real browser (not just mocked unit tests — the specific gap that caused two bugs in Milestone 1). The reference application can be removed without any change to the Shell Public API implementation, confirmed both by design (interface-only dependency via `SHELL_API`) and by grep showing zero references. The generalization boundary for future capabilities (direct reuse vs. Dialogs' request/response variant vs. Extension Points' distinct registration-with-lifecycle mechanism) is now explicit, so future milestones can build on this pattern deliberately rather than rediscovering the boundary mid-implementation.
