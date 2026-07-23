# Architecture Validation Report — Milestone 1 (Walking Skeleton)

**Date:** 2026-07-23
**Milestone:** M1 — shell + one federated reference application
**Status:** Complete, all approved acceptance criteria met

---

## Which architectural decisions were successfully validated?

| Decision / section | Validated how |
|---|---|
| **ARCH-2026-06 Decision 001** (Native Federation as the composition mechanism) | `hello-world-app` built as a Native Federation remote, `shell` as a host; the remote's `Component` export was loaded and mounted at runtime via `loadRemoteModule`, verified live in a real Chromium browser against the built `dist/` output. |
| **ARCH-2026-02 §4** (dependency direction — shell never imports application source, and vice versa) | Enforced by an ESLint `no-restricted-imports` rule (ADR-001), verified by deliberately introducing a violation in each direction and confirming the lint job fails; restored and confirmed clean. |
| **ARCH-2026-02 §5** (deletion test — removing an app changes nothing in the shell) | Performed literally: emptied `projects/shell/public/manifest.json`, ran `git diff --stat` — exactly one file changed, zero lines under `projects/shell/src/**`. Shell built and its full test suite passed against the empty manifest. |
| **ARCH-2026-02 §6** (addition test — adding an app is additive, declarative registration only) | Restored the manifest entry; again exactly one file changed. No conditional branch keyed on application identity exists anywhere in shell source. |
| **ARCH-2026-03 §2** (application lifecycle: Discovery → Registration → Permission Evaluation → Navigation Registration → Initialization → Mount → Unmount → Disposal) | All stages implemented and exercised: Discovery/Registration/Permission Evaluation/Nav Registration in `PlatformManifestService.discover()`; Initialization/Mount/Unmount in `RemoteMountComponent`. Verified live: mount renders remote content, navigating away unmounts it and clears the DOM. |
| **ARCH-2026-03 §6** (capability negotiation — fail loudly at the boundary, never mount into an undefined state) | An entry with a mismatched `contractVersion` is rejected at Registration, before Navigation Registration — verified it never appears in the nav and a direct navigation to its path shows "not registered," not a crash or a half-mounted state. |
| **Milestone 1's added resilience criterion** (unreachable/incompatible/non-conforming remotes fail safely; one application's failure never affects the shell or another application) | Verified live with a 4-entry fault manifest: healthy app mounts normally; unreachable and non-conforming remotes both render a contained "unavailable" state; incompatible-version entry is excluded at Registration. In every case the shell chrome and the healthy app's nav entry remained fully functional. |
| **ADR-001** (single-workspace staging with tooling-enforced boundaries) | The workspace has two isolated Angular projects (`shell`, `hello-world-app`), each with its own `tsconfig`/build/test target; the contracts package is consumed via a bun workspace package (`@platform/manifest-schema`), never a relative import; the ESLint boundary rule is wired into CI. |

## Which assumptions proved correct?

- Native Federation's `loadRemoteModule({ remoteEntry, exposedModule, fallback })` API is sufficient to implement manifest-driven, on-demand Initialization/Mount without any build-time knowledge of remotes — `initFederation()` at shell boot needs zero remotes declared, which is itself a clean proof that the shell has no hard dependency on any application at the federation layer, not just at the Angular routing layer.
- A tooling-enforced boundary (ESLint rule + CI) inside one workspace is enough to make the shell/application dependency-direction rule real, without needing physical repo separation on day one — confirming ADR-001's central bet.
- Registering Permission Evaluation as an explicit (if stubbed) stage in the lifecycle, rather than skipping it, made it easy to slot in real entitlement checking later without restructuring the lifecycle.

## Which assumptions proved incorrect?

- **The exposed module's path name is not the same as its export name.** The initial implementation assumed exposing `'./Component'` in `federation.config.js` meant the loaded module would have a `Component`-named export — it doesn't; it exposes whatever the target file exports, which was `App` by default. This was a real design gap, not just a typo: the mount contract needed the export name itself to be part of the contract. Fixed by renaming the exposed file's export to literally `Component` and documenting the convention. This was caught only by live browser verification — the unit tests (which mocked `loadRemoteModule`'s return shape directly) did not and structurally could not have caught it.
- **A discovery/mount race condition.** The initial implementation had `RemoteMountComponent` check the registry synchronously against whatever `PlatformManifestService` currently held, without awaiting in-flight Discovery. On a direct navigation to a mounted route (not via in-app nav), the route's component initialized concurrently with the shell's own bootstrap and queried the registry before the manifest fetch resolved, incorrectly reporting "not registered." Fixed by adding `ensureDiscovered()`, a single shared promise every consumer awaits before trusting the registry. Also only caught by live verification, not unit tests (the unit tests inject a pre-populated stub, sidestepping the timing question entirely).
- **`ng serve`'s Vite-based dev server does not run under Bun in this environment** (an unrelated Bun/Vite compatibility issue, not an architectural defect). Live verification was performed by building both projects and serving the static `dist/` output instead — arguably a more faithful proxy for production behavior anyway, but it means the local dev-server experience is currently unverified on this machine.

## Were any ADRs created?

Yes — **ADR-001**, approved before implementation began (staging the shell and the first reference application in one workspace with tooling-enforced boundaries, pending repository separation). No additional ADRs were required during implementation; the two incorrect assumptions above were code-level bugs with clean fixes, not architectural gaps requiring a new decision.

## Does the implementation still comply with all approved architecture?

Yes. Specifically checked against the Golden Rules in ARCH-2026-02 §8 and ARCH-2026-03's Binding Principles:
- No domain vocabulary in the shell — confirmed, the shell knows nothing about `hello-world-app` beyond its manifest entry.
- The shell never imports application source — enforced by lint, verified by deliberate violation test.
- Every application contribution is revoked at Unmount — the mounted view is cleared on `ngOnDestroy`; verified live.
- Applications version against a published contract, never shell head — `contractVersion` is checked at Registration against `SUPPORTED_CONTRACT_VERSION`, not against whatever the shell happens to be running.

## What technical debt was intentionally accepted?

Each of these is a deliberate, named scope limitation for Milestone 1, not an oversight:

1. **Disposal (full ES-module unload) is not implemented.** Browsers have no API to unload an already-imported ES module from memory. Unmount (view teardown) is fully implemented; Disposal in the strict "release the loaded bundle" sense is out of scope until this is revisited, likely never fully closeable given platform constraints — worth an explicit note in a future decision rather than silently assumed solved.
2. **The platform manifest is served as a static build asset, not yet a CDN-hosted, independently-publishable artifact** (ARCH-2026-06 Decision 007's eventual target). Registering a new application currently still requires a shell rebuild. This is the correct scope for M1 (proving the runtime mechanism) but must be closed before Decision 007's registry mechanism is considered implemented.
3. **`@platform/manifest-schema` is not part of the Angular compiler's type-checked program during `ng build`** (esbuild bundles it but warns it isn't type-checked at build time). Low risk today since the package is small and pure-TypeScript with no Angular-specific syntax, but should be revisited once the contracts surface grows (Decision 003/Decision 008's type-checking layer).
4. **Permission Evaluation is a hard-coded stub (always allow).** Explicitly marked as such in code comments; real coarse-entitlement checking is scoped to Milestone 4 (auth).
5. **Resilience was proven with one real application plus synthetic fault entries in the same manifest**, not with two independently-real applications where one fails. The containment mechanism (per-route error state, chrome untouched) is structurally identical regardless of application count, but this is named explicitly rather than implied to be broader than it is.
6. **Local dev-server verification (`ng serve`) is unconfirmed** on this environment due to an unrelated Bun/Vite issue; verification was performed against built static output instead.

## Is it safe to proceed to the next milestone?

Yes. All approved Milestone 1 acceptance criteria are met with reproducible evidence (unit tests, a live-browser verification pass, and literal `git diff` proof of the addition/deletion test). The two incorrect assumptions found were fixed at the code level and did not require revisiting any ratified architecture or ADR. The six items of accepted debt are named, scoped, and each maps to a specific future milestone or decision rather than being open-ended.

**Recommendation:** proceed to Milestone 2 (Shell Public API v0 + runtime communication spine).
