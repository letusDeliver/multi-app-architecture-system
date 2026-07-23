# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Documentation

- Whenever a new feature, module, decision doc, or significant piece of work is added to this project, update `README.md` to reflect it. The README should stay current as a demonstration/overview of the project — don't let it drift out of date.

## Ratified architecture rules (ARCH-2026-06)

These are binding engineering decisions already ratified in [`docs/architecture/enterprise-platform-implementation-decisions.md`](docs/architecture/enterprise-platform-implementation-decisions.md). Treat them as constraints on any code, config, or new decision proposed in this repo — don't contradict them without an explicit, deliberate re-ratification (not a quiet edit). This list will grow as more decisions are ratified.

1. **Composition & runtime loading** — Applications are composed via **Native Federation** (ESM + import maps), loaded at runtime. Never compile application source into the shell's own build.
2. **Shared/singleton dependencies** — Angular framework packages (core/common/platform-browser, zone/zoneless runtime) are strict singletons, bounded to current major + previous major; mismatched apps fail to mount with a diagnostic. RxJS and small utility libraries are singleton-preferred with wider tolerance.
3. **Supply-chain integrity** — Federated bundles are verified via SRI hashes before executing; the loader only fetches from a centrally governed origin allowlist; SCA/dependency-vulnerability scanning is a mandatory CI gate in every repo. Build provenance/signing is deferred, not yet mandated.
4. **Repository strategy** — Hybrid split: shell + contracts/SDK + design system live in one platform repo; every application lives in its own separate repo. Never let application source get checked into the platform repo or vice versa.
5. **Backend service ownership** — The auth BFF and the observability backend each live in their own separate repos, owned by Identity/Security and Platform-Infra/SRE respectively — not folded into the platform repo.
6. **Contracts/SDK distribution** — Contracts are published, versioned npm packages on a private registry, split by concern (e.g. `@platform/identity-contracts`, `@platform/manifest-schema`, `@platform/shell-api-contracts`), never resolved at runtime via federation and never consumed via git submodule.
7. **State management** — Shell-owned live context (workspace, locale, session, feature flags, etc.) is exposed to applications as RxJS `Observable`s via the contracts package. Fixed-at-boot context (identity, tenant, org, environment) is exposed as plain resolved values. Application-internal state is not mandated; Angular Signals are recommended (docs/scaffolding only), never enforced via lint/CI.
8. **Cross-tab session sync** — Session changes propagate across tabs via `BroadcastChannel`, with a low-frequency background revalidation heartbeat as a fallback for suspended/backgrounded tabs.
9. **Design system** — Three tiers: design tokens; a shared, headless-where-possible component library (open-extend governance — compose/wrap allowed, forking or modifying shared source is not); a small shell-exclusive tier (toast host, dialog chrome, notification center, command palette) that applications only reach through the Shell Public API, never render directly.
10. **Scaffolding** — New application repos are created via a generator that does one-time wiring (federation config, pinned contract deps, design-system wiring, Signals-as-default). Ongoing conventions (CI templates, lint rules, tsconfig, build config) are consumed as versioned packages, never copy-pasted by the generator.
11. **Build & CI/CD** — The application registry is a versioned, CDN-hosted static manifest artifact (never compiled into the shell's build). The shell's CI includes a permanent empty-shell gate (manifest stubbed to zero entries). Contract/framework currency is enforced via three layers: telemetry dashboard, automated update PRs, and a hard CI gate at the bounded-version-window boundary.
12. **Testing** — Five-layer stack required: unit tests; type-checking against published contracts; consumer-driven contract tests (shell CI verifies against the union of all applications' published expectations); cross-boundary integration tests against a curated set of pinned real application builds; the empty-shell CI gate.
13. **Observability** — All error/event reporting (shell's fatal boundary and each application's recoverable boundary) goes through the Shell Public API, built on OpenTelemetry, with the backend vendor swappable behind an exporter. Applications may add their own supplementary internal tooling but must still report the mandatory baseline.
14. **Auth & session** — Implemented via a BFF pattern: httpOnly/Secure/SameSite session cookie, raw token held server-side only, never in JS-accessible storage or memory, in the shell or any application. OIDC is the mandatory default identity protocol; SAML is a secondary path for legacy enterprise IdPs only.

**Still open / not yet ratified** (don't treat as decided): shell deployment rollout/rollback strategy, automated accessibility testing layer, SCA-finding remediation SLA policy, feature-flag evaluation mechanism/vendor.

## Implementation mode — working rules

The platform architecture (ARCH-2026-01 through ARCH-2026-06) is frozen and is the source of truth for implementation. Do not redesign or contradict it. If implementation reveals a genuine gap or a decision the architecture didn't anticipate, **raise it as an ADR under `docs/adr/` and get approval before proceeding** — never modify the ARCH documents themselves, and never silently decide.

**ADRs currently in effect:**
- [ADR-001](docs/adr/ADR-001-milestone-1-workspace-staging.md) — Milestone 1 stages the shell and the first reference application in one workspace as physically isolated projects (tooling-enforced boundary), rather than separate repositories immediately. This is a staging decision, not a change to ARCH-2026-06 Decision 002's target end-state. It is fulfilled and superseded the moment a second real application or a second contributor is introduced — at that point repository separation becomes mandatory.

**Every implementation milestone is planned in this format**, in this order, and approved before any code is written:
1. Objective
2. Technical Deliverables
3. Architecture Validation (which ratified decisions/sections it proves)
4. Risks
5. Success Metrics
6. Exit Criteria

**Scope discipline.** The objective is to prove the platform architecture, not to build functionality ahead of what a milestone requires. If implementation reveals a need for something not in the approved scope for the current milestone (a new manifest field, a new dependency, a new capability), stop and ask before expanding scope — don't silently add it.

**End-of-milestone Architecture Validation Report.** Before starting the next milestone, produce a report answering:
- Which architectural decisions were successfully validated?
- Which assumptions proved correct?
- Which assumptions proved incorrect?
- Were any ADRs created?
- Does the implementation still comply with all approved architecture?
- What technical debt was intentionally accepted?
- Is it safe to proceed to the next milestone?

Only proceed to the next milestone after this report is reviewed.
