# ADR-001 — Temporary Single-Workspace Staging for Milestone 1

**Status:** Approved
**Decided:** 2026-07-23
**Type:** Implementation staging decision — does not amend ARCH-2026-02, ARCH-2026-03, or ARCH-2026-06 Decision 002

## Context

ARCH-2026-06 Decision 002 ratifies a hybrid repository model: the shell lives in a platform repo; every hosted application lives in its own separate repository. That remains the platform's target end-state, unchanged by this ADR.

Milestone 1's objective is narrower: prove that the shell and a hosted application can be composed and lifecycle-managed at runtime via Native Federation and a manifest, without the shell ever depending on the application's source at build time (ARCH-2026-02 §4/§5/§6, ARCH-2026-03 §2). That is a runtime-boundary claim. Standing up two repositories, cross-repo CI, and a private package registry before confirming the runtime mechanism works risks paying Decision 002's full operational cost before the thing it protects has even been shown to function.

## Decision

For Milestone 1 only, the shell and the first reference application (`hello-world-app`) are built in **one workspace**, as **physically isolated projects**, subject to the following binding constraints:

1. Two separate top-level projects (`projects/shell`, `projects/hello-world-app`), each with its own `tsconfig` and its own build/test target. No shared path aliases between them.
2. The contracts package (`@platform/manifest-schema`) is consumed by both projects as a **versioned package artifact** (local package link for now) — never as a relative source import across the two project folders. This is what makes the eventual split a config change rather than a refactor.
3. An ESLint rule forbidding any import from `projects/shell/**` inside `projects/hello-world-app/**`, and vice versa, wired into CI and failing the build on violation, present from the first commit.
4. Each project's build/test target must not require the other project's source to be present.
5. Git history for `hello-world-app` stays scoped to its own project folder, so it can be extracted later via `git subtree split` without history surgery.
6. No implicit sharing beyond what Decision 001's singleton addendum already permits (Angular/RxJS). The reference app may not depend on any shell-internal utility outside the published contracts.

## Migration Trigger

This staging ends, and `hello-world-app` is extracted into its own repository, **no later than** the point at which a second real application or a second engineering contributor is introduced. At that point, ADR-001 is considered fulfilled and this document is marked Superseded.

## Consequences

- Milestone 1 can iterate quickly on the actual unknown (does Native Federation + manifest lifecycle work) without cross-repo CI/registry overhead.
- The boundary between shell and application is enforced by tooling (constraints 1–4) rather than by physical separation, which is a real but accepted risk — the same failure mode ARCH-2026-02 §7 names as the most common way this architecture rots. Constraint enforcement in CI from commit one is what keeps this risk bounded.
- Migration to separate repositories remains mandatory and is not re-litigated; this ADR only sequences when it happens.

---
*Recorded per Milestone 1 approval, 2026-07-23.*
