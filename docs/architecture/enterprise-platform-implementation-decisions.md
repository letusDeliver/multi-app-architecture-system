# The Enterprise Platform — Implementation Architecture Decision Log

**Doc ID:** ARCH-2026-06 · Companion to ARCH-2026-01 (Angular Architecture) through ARCH-2026-05 (Experience & Interaction Model)
**Issued by:** Platform Architecture Review Board
**Status:** Living document — grows one ratified decision at a time
**Scope:** Concrete implementation and tooling decisions made in service of ARCH-2026-01 through ARCH-2026-05. Unlike those five documents, this one is explicitly technology-specific (Angular, build tooling, infrastructure) — it is where the framework-agnostic contracts already ratified get bound to real tools.

> **Reading note.** ARCH-2026-02 through ARCH-2026-05 are frozen and must not be contradicted. Every decision recorded here exists to make one or more of their rules mechanically true — not just true in a diagram. Each entry below is permanent once ratified, in the same sense the five foundational documents are: changing a ratified entry requires the same deliberate, mutually-agreed process that would apply to amending ARCH-2026-02 §4, not a quiet edit.

---

## Decision Log

### Decision 001 — Application Composition & Runtime Loading Strategy

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** ARCH-2026-02 §5 and §6 require that deleting or adding an application be a mechanical, additive, non-breaking event for the shell — not merely an architectural aspiration. ARCH-2026-03 §2's lifecycle model (Discovery → Registration → Mount → Unmount → Disposal) presumes applications are loaded at runtime, not compiled into the shell. ARCH-2026-05 §7 requires cross-application transitions to preserve shared chrome, focus, and continuity. All three depend entirely on how applications are actually composed and loaded — this decision is the mechanical foundation every other implementation decision in this log builds on.

**Options considered.**

| Option | Independent deploy | Shell/app decoupling | Verdict |
|---|---|---|---|
| Monorepo, single compiled Angular build (Nx + lazy routes, no runtime federation) | No — one release train for every application | No — deleting an app means editing and recompiling the build graph | Disqualified — fails ARCH-2026-02 §5/§6 as literal, mechanical fact |
| iframes per application | Yes | Yes, but at a UX cost | Rejected for internally-built apps — cannot satisfy ARCH-2026-05 §7 continuity (shared focus management, shared dialog/toast chrome, no reload-feel) without fighting the browser; the right tool for untrusted third-party embeds, not for 12 teams building one product |
| Webpack Module Federation | Yes | Yes | Viable, conservative alternative — mature, multi-year enterprise track record |
| **Native Federation** | Yes | Yes | **Selected** |

**Decision.** The platform standardizes on **Native Federation** (ESM + import-map based runtime federation, successor to Webpack Module Federation from the same tooling lineage) as the mechanism by which the shell discovers and mounts application bundles at runtime.

**Rationale.**
- Aligns with Angular's own build-tooling direction (esbuild/Vite), rather than running a Webpack-specific pipeline against the framework's own trajectory over a 10-year horizon.
- Simpler runtime model (native ES modules, import maps) for 50+ engineers across a dozen teams to reason about when debugging a failed remote load.
- Maps directly onto the manifest/remote-entry concept ARCH-2026-03 §2 already assumes — no new mental model introduced on top of what's already ratified.

**Trade-offs / risks.**
- Smaller production track record than Webpack Module Federation at extreme scale — accepted as a deliberate bet on tooling direction over years-of-battle-testing.
- Tooling and documentation maturity should be re-checked before the first application team onboards; if Native Federation's ecosystem stalls, Webpack Module Federation remains the fallback since both satisfy every ARCH-2026-02/03 test identically.

**Future implications.** Every subsequent implementation decision that touches build tooling (repository strategy, contracts package distribution, CI/CD pipeline design, dependency-sharing between the shell and applications) must be compatible with a Native Federation runtime. The manifest schema referenced in ARCH-2026-03 §2/§6 will be specified in terms of Native Federation's remote-entry model in a future decision in this log.

#### Addendum — Shared/Singleton Dependency Policy

**Status:** Ratified
**Decided:** 2026-07-23 (added on review, after Decisions 002–005)

**Problem.** Decision 001 fixed the loading mechanism but left one question open: which dependencies are shared as singletons between the shell and every federated remote, and what happens on a version mismatch. This surfaced as a live gap during review — Decision 004 asserts that "RxJS is boundary-safe by construction," which is only actually true if a coherent cross-remote version policy exists; without one, that claim was an assumption, not a guarantee. The two classes of dependency involved carry genuinely different risk: duplicate instances of the Angular framework itself (core, zone.js/the zoneless runtime, platform-browser) are a correctness hazard — competing change-detection cycles, split DI containers — not merely a bundle-size cost; duplicate instances of RxJS or small utility libraries are mostly a size cost, since `Observable`'s duck-typed `.subscribe()` contract interoperates correctly across instances.

**Options considered.**

| Option | Verdict |
|---|---|
| No singletons — every remote bundles its own copy of everything | Rejected — multiplies framework bundle size by application count and risks real multi-instance Angular correctness bugs, not merely a theoretical concern |
| Strict singleton, one exact version platform-wide | Rejected — forces all 75 application teams into lockstep upgrades on every shell framework change, reintroducing the exact coordination tax ARCH-2026-03 §6 already rejected for the contracts layer, now applied to the framework itself |
| **Tiered policy** — framework-critical dependencies strict-singleton within a bounded version window; interop-safe libraries singleton-preferred with wider tolerance | **Selected** |

**Decision.** Shared dependencies are declared through Native Federation's singleton mechanism in two tiers:
1. **Framework-critical** (Angular core/common/platform-browser, the zone or zoneless runtime) — strict singleton, bounded to **current major + previous major**, the identical window ARCH-2026-03 §6 already ratified for the contracts layer, applied one layer down to the framework itself. An application declaring a version outside that window fails to mount at Registration (ARCH-2026-03 §2) with a clear diagnostic, reusing §6's "fail loudly at the boundary, never mount into an undefined runtime state" rule rather than inventing a parallel one.
2. **Interop-safe libraries** (RxJS, small shared utilities) — singleton-preferred, with a wider tolerated range, since cross-instance interop does not carry the same correctness risk as duplicate framework instances.

**Rationale.** Closes the gap Decision 004 implicitly depended on: RxJS boundary-safety is now a stated policy, not an assumption. Prevents duplicate Angular runtime instances — a genuine correctness risk — without forcing whole-platform lockstep upgrades, by reusing the bounded-window concept ARCH-2026-03 §6 already established rather than inventing new versioning philosophy.

**Trade-offs / risks.** An application team on Angular version N-2 cannot be mounted at all until it upgrades — a real constraint, not a hypothetical one. This requires the platform team to actively announce and enforce an Angular upgrade cadence with the same discipline ARCH-2026-03 §6 already mandates for contract deprecations; a silently-lapsed enforcement here reintroduces the very risk this addendum closes.

**Future implications.** The manifest schema (`@platform/manifest-schema`, per Decision 003) must declare each application's built framework version so Registration-time negotiation (ARCH-2026-03 §2) can check it against the current supported window.

#### Addendum — Supply-Chain & Remote-Load Integrity Policy

**Status:** Ratified
**Decided:** 2026-07-23 (added on review, after Decisions 002–008)

**Problem.** Decision 001's choice of Native Federation over iframes — made specifically to preserve the continuity ARCH-2026-05 §7 requires — means every federated application executes in the shell's own origin and trust boundary, with no sandbox. Decision 007 then made the manifest a governed, but still CDN-hosted, static artifact pointing at remote-entry URLs. Neither decision addressed what stops the shell from executing code that isn't actually what the owning team published, or a manifest entry pointing somewhere it shouldn't — a live gap surfaced on review, not a hypothetical one, given how the platform's core loading mechanism actually works. Two distinct threats are in scope: **post-publish tampering** (a compromised CDN, a hijacked URL, or a man-in-the-middle altering a bundle after it was legitimately published) and **a compromised publish pipeline** (an attacker who already controls an application team's CI publishing a malicious build together with a matching integrity record for it) — the second is not caught by integrity verification alone, since the attacker controls both sides of that check.

**Options considered.**

| Control | Verdict |
|---|---|
| No integrity verification (status quo) | Disqualified — this is the gap the addendum exists to close |
| **Subresource Integrity (SRI) hashes**, computed during the manifest's already-governed publish step (Decision 007), verified by the federation loader before executing | **Selected** — closes post-publish tampering at low cost, mechanically attaches to a pipeline step that already exists |
| **Origin allowlisting** — the federation loader refuses to fetch from any origin not on a centrally-governed list, regardless of manifest claims | **Selected** — closes accidental or malicious re-pointing of a manifest entry, at low cost |
| **Mandatory dependency/vulnerability (SCA) scanning** in every repo's CI, shell included | **Selected** — closes known-vulnerable transitive dependencies anywhere in the shared trust boundary |
| **Cryptographic build provenance/signing** (each application's CI signs its build; the shell verifies signature/provenance before executing) | **Deferred** — closes the compromised-publish-pipeline threat, but requires standing up real signing infrastructure; treated as a deliberate future-hardening step, not a day-one mandate, mirroring how the centralized bootstrapping portal was deferred in Decision 006 |

**Decision.** The platform mandates, effective immediately: (1) **SRI-style integrity verification**, with hashes computed automatically as part of the manifest's governed publish step (Decision 007) and checked by the federation loader before any remote-entry bundle executes; (2) **origin allowlisting**, so the shell will only ever fetch federated code from a centrally-governed, explicit list of origins, independent of what any individual manifest entry claims; (3) **mandatory SCA/dependency-vulnerability scanning** as a CI gate in every repo, application and shell alike, using the same "gate, don't just report" principle already established for currency enforcement (Decision 007). **Cryptographic build provenance/signing is explicitly deferred** as a named future-hardening item, not silently dropped.

**Rationale.**
- The three mandated controls close the higher-likelihood threats (CDN compromise, dependency vulnerabilities) at low incremental cost, by attaching directly to CI/publish steps this log has already ratified — no new pipeline stage needs to be invented from scratch.
- Deferring signing/provenance rather than mandating it now keeps this decision scoped to the actual risk in front of the platform today, consistent with this log's recurring discipline (Decision 006) of not committing to heavier infrastructure than the current problem strictly requires — while still recording it explicitly, so it is a deliberate future decision, not a silently dropped concern.

**Trade-offs / risks.**
- The compromised-publish-pipeline threat remains open until provenance/signing is revisited — this is an accepted, explicitly-named residual risk, not an oversight.
- Origin allowlisting means onboarding a new application also requires its hosting origin to be added to the allowlist — a small additional step in the scaffolding/onboarding flow (Decision 006) that must not be forgotten or the app will fail to load despite a valid manifest entry.
- SCA scanning will surface findings across 75 independently-owned repos; this requires a triage and remediation-SLA policy (who fixes a critical vulnerability found in application X's dependency, and by when) that is not itself resolved by this addendum.

**Future implications.** Cryptographic build provenance/signing should be revisited as its own future decision once the platform has enough operational maturity to justify the investment — this addendum records that as a deliberate, tracked gap rather than an unstated one. The remediation-SLA policy for SCA findings is likewise flagged as a near-term follow-up, not resolved here.

---

### Decision 002 — Source Repository Strategy

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** Decision 001 fixed *how* application bundles are loaded at runtime; it says nothing about *where the source lives* or *who can physically commit next to whom*. Repository topology is the first line of enforcement for ARCH-2026-02 §4's dependency-direction rules (the shell never imports application source; applications never import each other's source) and directly determines whether ARCH-2026-03 §6's independent-release-cadence guarantee is mechanically achievable or merely aspirational.

**Options considered.**

| Option | Decoupling enforcement | Cross-team friction |
|---|---|---|
| Full polyrepo (shell, contracts, and every one of the 75 applications each in its own repo) | Strongest possible, everywhere | Highest — versioning, scaffolding, and release orchestration must be built for 77+ repos |
| Single monorepo, all 75 apps + shell + contracts, Nx-enforced boundaries | Enforced by tooling/lint discipline, not physical impossibility | Lowest day-to-day friction, but the repo itself becomes a scaling and governance bottleneck at full application count |
| **Hybrid** — shell + contracts + shared/design-system in one governed repo; each application (or small related group) in its own repo | Strong exactly where ARCH-2026-02's hardest trust boundary sits (shell+shared vs. applications) | Moderate — requires a published contracts package (Decision 002 dependency → Decision 003) and a solid project scaffold, but application-to-application friction is a non-issue since apps don't share a repo at all |

**Decision.** The platform splits source into a **hybrid repository model**: the shell, the published contracts/SDK layer, and the shared/design-system layer live together in one platform-owned repository; every hosted application lives in its own separate repository, owned entirely by its application team.

**Rationale.**
- Places a *physical*, not merely configured, boundary exactly on the relationship ARCH-2026-02 §4 treats as non-negotiable — application source is not even checked out alongside shell internals or another application's source, so the import violation named in ARCH-2026-02 §4/§7 is structurally impossible, not just linted against.
- Directly forecloses ARCH-2026-02 §7's "shell grew out of app #1" failure mode — no application code can ever be present in the repo that defines the shell.
- Gives each application team a fully independent release cadence (ARCH-2026-03 §6) with zero contention over shared CI queues, lint config, or repo-wide refactors driven by other teams.

**Trade-offs / risks.**
- Only works if the platform team invests in a strong project generator/scaffold and a rock-solid published contracts package — both are now load-bearing, and both are already queued in this log (Decision 003 covers the contracts package next). Without them, 75 application repos will independently drift on build config, linting, and CI setup, recreating ARCH-2026-02 §1's duplication problem one layer down.
- Named alternative not chosen: a single Nx-governed monorepo (all 75 apps + shell + contracts) was the closest competitor — it offers lower day-to-day friction and atomic cross-cutting changes, and remains a legitimate choice for organizations that prioritize platform-team velocity and already have strong Nx boundary discipline over physical team isolation. Rejected here in favor of the stronger, physically-enforced boundary given the 10-year, 12-team, 75-application horizon this platform is designed for.

**Future implications.** Decision 003 (contracts/SDK package distribution and versioning) is now a hard dependency of this decision, not an independent concern — the hybrid split only works if that package is published, versioned, and consumable by 75 independent repos without any of them touching the platform repo directly.

#### Addendum — Backend Service Ownership (BFF & Observability Backend)

**Status:** Ratified
**Decided:** 2026-07-23 (added on review, after Decisions 009 and 010)

**Problem.** This decision deliberately scoped the platform repo as frontend-shaped artifacts — the shell, the contracts/SDK layer, and the shared/design-system layer. Decision 009 (observability) and Decision 010 (authentication) subsequently introduced two genuine backend services — an OpenTelemetry ingestion/collection backend and the auth BFF — that don't naturally fit that scope and were left absent from ARCH-2026-03 §7's ownership table, a gap surfaced on review rather than at the time either decision was made.

**Options considered.**

| Option | Verdict |
|---|---|
| Fold both services into the platform repo alongside the shell | Rejected — dilutes this decision's original reasoning, which deliberately scoped the platform repo tightly around frontend governance; stretches the shell/platform team's mandate into backend infrastructure and security-sensitive authentication systems outside its expertise |
| **Separate repos, owned by the appropriately specialized teams**, each exposing a published, versioned interface contract the shell depends on | **Selected** |

**Decision.** The BFF and the observability backend each live in their **own separate repositories**, outside the platform repo defined by this decision. The BFF is owned by an **Identity/Security team**; the observability backend is owned by a **Platform-Infra/SRE team**. Each exposes a published, versioned interface contract — the BFF's session-cookie behavior and endpoints, the observability backend's ingestion/exporter endpoint — that the shell team depends on, in the same shape of relationship the shell already has with application teams.

**Rationale.** Matches how these concerns are typically staffed at organizations of this scale — auth infrastructure and observability infrastructure both warrant dedicated expertise most frontend platform teams don't have and shouldn't be expected to develop. Keeping them out of the platform repo preserves the tight governance scope this decision originally established rather than diluting it with unrelated backend concerns.

**Trade-offs / risks.** The shell team now depends on two additional external teams' release cadences for anything touching authentication or observability — this must be managed with the same versioned-contract discipline already applied to the contracts package (Decision 003) and the design system (Decision 005), not an informal handshake. Onboarding a new application team now requires coordination across three teams (platform, identity/security, platform-infra) rather than one — a real, if manageable, coordination cost worth naming rather than ignoring.

**Future implications.** ARCH-2026-03 §7's ownership table should be treated as extended, not contradicted, by two new rows: **BFF/session infrastructure** (mechanism owner: Identity/Security team) and **Observability backend** (mechanism owner: Platform-Infra/SRE team) — recorded here since ARCH-2026-03 itself is frozen and not to be edited directly.

---

### Decision 003 — Contracts / SDK Package Distribution & Versioning

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** Decision 002's hybrid repo split is only real if 75 application repos can consume the platform's contracts (identity shapes, event/command payloads, the registration/manifest schema, the Shell Public API surface of ARCH-2026-03 §4) without ever checking out the platform repo. This decision also supplies the concrete mechanism behind ARCH-2026-03 §6's already-ratified versioning *rules* (semantic discipline, bounded multi-version support, announced deprecation, capability negotiation at the boundary) — §6 ratified the rules; this decision ratifies the artifact they govern.

**Options considered.**

| Option | Verdict |
|---|---|
| Runtime-resolved shared contract (loaded via Native Federation itself, as a shared remote) | Disqualified outright — an application would receive whatever contract version the shell is currently running rather than the version it built and tested against, directly reintroducing "build against shell head," which ARCH-2026-03 §6 explicitly forbids |
| Git submodule/subtree of contracts source | Rejected — pins consumers to a commit SHA, not a negotiated semver contract version; gives capability negotiation (§6) nothing to attach to, and is error-prone for engineers to use correctly at scale |
| **Published package(s) via a private npm registry** | **Selected** |

**Decision.** The contracts/SDK layer is distributed as **published packages on a private npm registry**, consumed by every application repo as an ordinary versioned dependency, released from the platform repo's own pipeline. The layer is **split by concern** rather than shipped as one unified package (e.g., `@platform/identity-contracts`, `@platform/event-contracts`, `@platform/manifest-schema`, `@platform/shell-api-contracts`), so that ARCH-2026-03 §6's additive-vs-breaking semantics apply independently per concern rather than being conflated under one version number.

**Rationale.**
- The only distribution mechanism among those considered that doesn't contradict an already-ratified rule (ARCH-2026-03 §6).
- Standard, well-understood tooling (registry + semver + changesets/semantic-release) that 50+ engineers across 12 teams already know how to consume — no bespoke mental model to teach.
- Splitting by concern means an application team only needs to evaluate a version bump in the specific contract that actually changed, rather than re-reviewing an entire monolithic contracts release for changes irrelevant to them — a more precise fit for §6's capability-negotiation model.

**Trade-offs / risks.**
- Requires standing up or subscribing to private registry infrastructure and a real release pipeline for the contracts repo — this is now load-bearing infrastructure, not an afterthought.
- More packages means more surface to document and discover; mitigated by the developer-experience/scaffolding decision still pending in this log (see roadmap), which should generate correctly-pinned dependencies on all relevant contract packages automatically for a new application.

**Future implications.** The manifest schema (ARCH-2026-03 §2/§6) will ship as `@platform/manifest-schema`; the Shell Public API types (ARCH-2026-03 §4) as `@platform/shell-api-contracts`. The developer-scaffolding decision later in this log must generate new application repos with correct, pinned dependencies on exactly the contract packages that application needs — never a blanket dependency on all of them.

---

### Decision 004 — State Management Strategy

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** ARCH-2026-03 §1 already ratified *who owns* every runtime context and classified each as fixed-at-boot or live, requiring live contexts to be exposed as "a subscribable, continuously-current contract." It deliberately left the actual mechanism framework-agnostic. Decision 001 (Native Federation) makes this concrete and harder than it would be in a single compiled bundle: the shell and an application are independently-built artifacts communicating across a runtime-federation boundary, not two modules in one build. This decision fixes the mechanism for (a) shell-owned live state crossing that boundary, and (b) how prescriptive the platform is about an application's own internal state.

**Options considered — boundary-crossing mechanism.**

| Option | Verdict |
|---|---|
| Bespoke pub/sub event bus | Disqualified — ARCH-2026-03 §3 already ratified events/commands/service-APIs as the communication model; a second, different bus for live-context propagation fragments that model and repeats the "second implementation of a shell capability" anti-pattern named in ARCH-2026-03 §4 |
| Angular Signals, exposed via the contracts package | Rejected for this specific use — Angular's own forward direction and excellent for internal state, but no mature, standard pattern yet for safely crossing a runtime-federation boundary between independently-built, independently-versioned bundles without a bespoke proxy/serialization layer |
| **RxJS Observables, exposed via the contracts package** | **Selected** |

**Options considered — application-internal state prescriptiveness.**

| Option | Verdict |
|---|---|
| Mandate Signals platform-wide, enforced by lint/CI | Rejected — reaches into application internals, which ARCH-2026-02 §2 explicitly reserves to the owning application team |
| No platform opinion at all | Rejected — forfeits a real, low-cost consistency benefit for engineers moving between application teams, with no corresponding gain in team autonomy that a *recommendation* (as opposed to a mandate) wouldn't already provide |
| **Recommend Signals in guidance and scaffolding; do not enforce via lint/CI** | **Selected** |

**Decision.**
1. Every shell-owned live context (workspace, locale, timezone, feature flags, session state, permissions, cross-cutting preferences — the "live" column of ARCH-2026-03 §1's table) is exposed to applications as an **RxJS `Observable`** through the relevant contracts package (Decision 003). Fixed-at-boot contexts (identity, tenant, organization, environment) are exposed as plain resolved values, consistent with ARCH-2026-03 §1's rule that they never mutate in place for the session.
2. Application-internal state (an application's own local data, forms, and UI state, entirely inside its own content region per ARCH-2026-02 §2) is **not mandated** by the platform. The platform **recommends Angular Signals** as the default in documentation and in the scaffolding generator (a pending decision in this log), but does not enforce it via lint or CI — enforcement stops exactly at the shell/application boundary already drawn in ARCH-2026-02 §4.

**Rationale.**
- RxJS's `.subscribe()` contract requires no shared Angular injector or change-detection context between publisher and subscriber, making it boundary-safe by construction — the correct fit for two independently-built, independently-versioned artifacts, exactly the situation Decision 001 creates.
- Reusing RxJS for live-context propagation, rather than inventing a parallel bus, keeps the platform's communication surface to the single model already ratified in ARCH-2026-03 §3, instead of two subtly different ones engineers must learn to distinguish.
- Recommending, not mandating, Signals for internal state respects the exact line ARCH-2026-02 §2 already drew between shell-owned mechanism and application-owned content — while still capturing the real, low-cost consistency benefit of a shared default for engineers moving between application teams.

**Trade-offs / risks.**
- Two different reactive primitives now coexist on the platform (RxJS at the boundary, Signals recommended internally) — this is a deliberate, justified split, not an oversight, but it must be documented clearly and early (in onboarding and scaffolding) so engineers understand *why* the boundary uses one and internals use the other, rather than perceiving it as inconsistency.
- Because internal-state guidance is a recommendation, not an enforced rule, some drift across 75 application teams is expected and accepted as the cost of respecting ARCH-2026-02 §2's boundary — this is not a defect to fix later, it is the deliberate trade-off made here.
- If Angular ships a mature, standard cross-federation-boundary Signal interop pattern in a future release, this decision should be revisited — but only as a deliberate re-ratification, not a quiet substitution, per this document's opening rule.

**Future implications.** The `@platform/shell-api-contracts` package (Decision 003) will type every live-context accessor as an `Observable<T>`, never a raw Signal, at the boundary. The scaffolding decision later in this log should generate new applications with Signals wired as the local-state default, with a clear example of subscribing to a shell-exposed Observable and (if an application wants a Signal locally derived from it) converting at the boundary via `toSignal()` inside the application's own code — never inside the contracts package itself.

#### Addendum — Cross-Tab Session Synchronization

**Status:** Ratified
**Decided:** 2026-07-23 (added on review, after Decision 010)

**Problem.** ARCH-2026-02 §2 requires that "cross-tab forced logout must be centralized," and ARCH-2026-03 §1 classifies Session as a live state machine. Decision 010's BFF pattern ensures the *next* request from any tab fails once the server-side session is invalidated, but each open tab also holds its own independent, in-memory copy of session state (the live `session$` Observable from this decision) in its own JS execution context. Nothing decided so far propagates a session change originating in one tab — idle timeout, a 401 response, an admin-forced logout — to other already-open tabs, which would otherwise continue rendering as authenticated until their own next API call happens to fail.

**Options considered.**

| Option | Verdict |
|---|---|
| Polling only (each tab periodically asks the BFF whether its session is still valid) | Rejected as the primary mechanism — works universally, but adds constant background chatter across every open tab and has an inherent detection delay, leaving a window where a revoked tab still shows authenticated UI, directly undermining ARCH-2026-02 §2's centralized, cross-tab intent |
| `localStorage` event trick (write a dummy key to trigger the cross-tab `storage` event) | Rejected — a legacy workaround pattern that the purpose-built API below was specifically introduced to replace |
| **BroadcastChannel API as the primary mechanism, with a low-frequency background revalidation heartbeat as a fallback** | **Selected** |

**Decision.** Session-state changes propagate across tabs via the browser's native **BroadcastChannel API**: the tab that detects a change (idle timeout, a 401, an explicit logout) posts a message on a shell-owned channel, and every other open tab's shell instance updates its `session$` Observable and transitions to the appropriate ARCH-2026-05 §6 state (Session Expiring/Expired) immediately. A **low-frequency background revalidation heartbeat** against the BFF serves as a fallback for the edge case of a tab the browser has suspended or backgrounded and which may have missed the broadcast.

**Rationale.** BroadcastChannel closes the gap instantly and natively, without the legacy workarounds `storage`-event tricks require. The heartbeat fallback follows this log's now-established "primary mechanism plus backstop" pattern, already used for currency enforcement (Decision 007) and observability (Decision 009) — a single mechanism alone, however good, is not treated as sufficient for a cross-cutting guarantee this platform has now frozen twice (ARCH-2026-02 §2, ARCH-2026-03 §1).

**Trade-offs / risks.** The heartbeat interval is a real trade-off between background network chatter and worst-case detection latency for the fallback path — this should be tuned empirically rather than guessed, and revisited if it proves too chatty or too slow in practice. BroadcastChannel is same-origin only, which is exactly the boundary needed here since cross-origin tabs are out of scope for this platform's session model.

**Future implications.** The scaffolding generator (Decision 006) and the shell's own session-management code should treat this channel as part of the core session contract, not an optional add-on — any application-facing documentation of `session$` should note that its updates may originate from another tab, not only from the current one.

---

### Decision 005 — Design System / Shared Component Strategy

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** ARCH-2026-02 §2 names the shared/design-system layer as a required singleton, and ARCH-2026-05 §1/§3 depend on visual and behavioral consistency across 75 applications for the platform to feel like one product rather than a bag of tools. Decision 002's hybrid repo split means this layer is authored in the platform repo but consumed across 75 separate application repos — this decision fixes both what the layer actually contains and how strictly it's governed once teams start consuming it.

**Options considered — layer composition.**

| Option | Verdict |
|---|---|
| Full component library only | Risks the exact failure ARCH-2026-02 §4 names — components accumulating app-specific escape hatches ("becoming feature code wearing a shared label") over years without a clear tokens/components separation |
| Design tokens only | Rejected — solves visual consistency but not behavioral/accessibility consistency; 75 independently-built buttons is precisely the duplication ARCH-2026-02 §1 exists to eliminate |
| **Layered: tokens + a shared, headless-where-possible component library + a small shell-exclusive tier** | **Selected** |

**Options considered — governance strictness.**

| Option | Verdict |
|---|---|
| Closed (all changes routed through the design-system team) | Rejected as the default — risks the platform team becoming a bottleneck for every edge case surfaced by 75 teams |
| **Open-extend** (compose/wrap allowed; forking or modifying shared source not allowed) | **Selected** |
| Fully open (forking permitted) | Rejected — this is the "over-centralizing vs. forking" failure ARCH-2026-02 §7 already names in its other direction; forked copies drift, and the canonical implementation becomes untraceable over years |

**Decision.** The shared layer ships in three deliberately separated tiers:
1. **Design tokens** (color, spacing, typography, elevation) — consumed by both shared components and, where an application composes its own UI, directly by applications.
2. **A shared, headless-where-possible component library** (buttons, inputs, cards, tables, form controls) — the default building block every application composes with; open-extend governance (below).
3. **A small shell-exclusive tier** (toast host, dialog chrome, notification center, command palette) — these are not merely "shared components," they are rendering surfaces ARCH-2026-03 §4 already ratified as shell-owned end-to-end; applications supply content into them via the Shell Public API (Decision 003's contracts), never render a version of them directly.

Governance for tier 2 is **open-extend**: application teams may compose and wrap shared components with their own props, logic, and layout, but may not fork or modify a shared component's own source. Any gap a shared component can't accommodate is raised to the design-system team as an API enhancement request, not solved by a local fork.

**Rationale.**
- The three-tier split directly mirrors the "hard vs. soft ownership" distinction ARCH-2026-02 §2 already ratified — most components are shared infrastructure any team composes freely; a small, named set are shell-exclusive because the shell owns their rendering surface, not merely their appearance.
- Open-extend is the point on the governance spectrum that avoids both failure modes ARCH-2026-02 §7 names by name: it doesn't bottleneck 75 teams behind one platform team (closed), and it doesn't produce untraceable, drifting forks (fully open) — provided the design-system team holds up its end with genuinely composable component APIs.

**Trade-offs / risks.**
- Open-extend only works if the design-system team invests in real API design discipline — components need enough configurability (slots, composition points, escape-hatch props) that teams rarely feel forced to fork. If that investment doesn't happen, teams will route around a too-rigid library exactly the way fully-open governance would have allowed anyway, just informally and undocumented.
- The shell-exclusive tier must be kept deliberately small and named explicitly (starting list: toast host, dialog chrome, notification center, command palette, per ARCH-2026-03 §4's table) — any temptation to grow this list beyond what ARCH-2026-03 §4 already designates as shell-owned should be treated as a Tier 3 governance event (ARCH-2026-03 §7), not a casual addition.

**Future implications.** The scaffolding decision later in this log should generate new application repos with the tokens and tier-2 component library pre-wired as dependencies. Any future proposal to add a component to the shell-exclusive tier must go through the same Tier 3 review ARCH-2026-03 §7 already assigns to Shell API changes, since it directly extends that same table.

---

### Decision 006 — Developer Experience & Scaffolding for New Application Teams

**Status:** Ratified
**Decided:** 2026-07-23
**Note:** Resequenced ahead of build/CI-CD strategy on review, after Decisions 002, 003, and 005 were each found to depend on this existing and working well.

**Problem.** Decision 002's hybrid repo split, Decision 003's per-application contract dependencies, and Decision 005's pre-wired design-system consumption all assume a new application repo starts out correctly configured. None of them addressed the mechanism, and leaving it for last risked the first several application teams hand-rolling their own setup and becoming an accidental, uncontrolled template — the "inconsistent registration paths" failure ARCH-2026-02 §7 already names.

**Options considered.**

| Option | Verdict |
|---|---|
| Generator only (CLI/schematic scaffolds a new repo once, at creation) | Rejected as insufficient on its own — generated config is a one-time snapshot; a later platform-team improvement to CI, lint, or build config never reaches an already-scaffolded repo, reintroducing the exact config-drift risk Decision 002 already named as a trade-off, a second time |
| **Generator + upgradeable shared config packages** (generator does one-time wiring; CI templates, lint rules, tsconfig, and build config ship as versioned packages the app depends on) | **Selected** |
| Centralized bootstrapping portal (Backstage-style internal developer portal provisioning repo, CI, registry access, first deploy) | Rejected for now — a legitimate future evolution, but a significant new infrastructure and operational commitment that is premature relative to the narrower problem actually in front of the platform (stopping config drift across independently-owned repos) |

**Decision.** New application repos are created via a **generator** (CLI/schematic) that performs one-time wiring — initial federation config, correct pinned contract-package dependencies (Decision 003), design-system wiring (Decision 005), and Signals-as-local-state-default scaffolding (Decision 004). Ongoing platform conventions — CI pipeline templates, lint rules, tsconfig base, build configuration — are **not copied by the generator**; they are consumed as **versioned, published packages** the application repo depends on, using the identical publish/consume pattern already ratified for contracts (Decision 003) and the design system (Decision 005).

**Rationale.**
- Solves the harder, more valuable half of the problem: not just correct at creation, but correctable *after* creation, since a platform-team improvement ships as an ordinary dependency bump rather than requiring every existing repo to be manually patched or regenerated.
- Reuses a pattern engineers already have to learn once (contracts, design system, now build/lint config) rather than introducing a fourth, different mechanism for "how platform conventions reach an application repo."
- Avoids committing to portal-level infrastructure before the platform has enough applications or organizational weight to justify the investment — keeps the decision scoped to the actual problem at hand.

**Trade-offs / risks.**
- Shared config packages become their own governed asset requiring the same deprecation discipline ARCH-2026-03 §6 already mandates for contracts — a breaking lint-rule or build-config change cannot be pushed silently to 75 repos any more than a breaking contract change could.
- The generator itself must be kept current with the shared-config packages' latest versions, or new applications will start out already behind — the generator and the config packages must be released in coordination, not independently drift from each other.
- Detecting *whether* an application has fallen behind on shared-config versions is not solved by this decision alone — that enforcement mechanism belongs to the CI/CD strategy decision next in this log.

**Future implications.** The build & CI/CD strategy decision (next in this log) must specify how staleness against the shared-config packages is detected and surfaced — this decision supplies the upgrade *mechanism* (a dependency bump), not the *enforcement* that teams actually do it.

---

### Decision 007 — Build & CI/CD Strategy

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** Three separate mechanical questions were still open after Decision 006: (a) where the application registry/manifest actually lives and whether adding an application touches the shell's own build or deploy pipeline at all; (b) how ARCH-2026-02 §5's "empty shell" CI gate is concretely implemented, not just asserted; (c) how the platform enforces that 75 independent application repos stay within the bounded contract/framework version window (ARCH-2026-03 §6; the Decision 001 singleton addendum) rather than silently drifting outside it — the staleness-detection gap Decision 006 explicitly deferred to this decision.

**Options considered — registry location.**

| Option | Verdict |
|---|---|
| Compiled into the shell's build at compile time | Disqualified — every new application registration would require a platform-team-run shell rebuild and redeploy, mechanically violating ARCH-2026-02 §6's additive-registration guarantee, the same way a single monolithic build violated ARCH-2026-02 §5/§6 in Decision 001 |
| Separately-deployed registry service (API/backend) | Rejected — achieves the same zero-shell-redeploy benefit as the option below, but introduces a new stateful service with its own uptime/ownership/on-call story for what is fundamentally a small, infrequently-changing dataset |
| **Versioned, CDN-hosted static manifest artifact**, published via a governed CI step in a dedicated manifest repository | **Selected** |

**Options considered — currency enforcement for contracts/shared-config packages.**

| Option | Verdict |
|---|---|
| Dashboard only (visibility, no automation or enforcement) | Rejected as insufficient alone — places all update effort on application teams' own initiative with no forcing function; historically only versions at the edge of the window get attention, usually under time pressure |
| Dashboard + automated update PRs, no hard gate | Considered but insufficient alone — keeps the common case low-friction but leaves ARCH-2026-03 §6's bounded support window a policy rather than a guarantee, since nothing actually stops a deploy from shipping outside it |
| **All three layered**: dashboard (telemetry) + automated bot PRs (low-friction common case) + hard CI gate at the bounded-window boundary | **Selected** |

**Decision.**
1. **Registry mechanism.** The application registry is a **versioned, CDN-hosted static manifest artifact** — structured data (application id, remote-entry reference, entitlement, nav metadata per ARCH-2026-02 §6), published from a dedicated manifest repository via a governed CI step (schema validation + Tier 1 review against the entitlement map, per ARCH-2026-03 §7). The shell fetches this artifact at boot (Discovery, ARCH-2026-03 §2) and on manifest refresh — never compiles it into its own build. Adding or removing an application is therefore a change to this artifact alone; shell source and shell deploy are untouched in either direction.
2. **Empty-shell CI gate.** ARCH-2026-02 §5's permanent "empty shell" build is implemented as a dedicated CI stage on the shell's own pipeline that points the shell's manifest-fetch at a stub artifact containing zero entries, then builds, boots, and runs the shell's full test suite against it. This is a direct, mechanical consequence of Decision (1): because the registry is already an external, swappable artifact, proving the shell survives an empty one requires no additional mechanism beyond pointing the fetch at a different, deliberately empty source in CI.
3. **Currency enforcement.** Three layered mechanisms, each serving a distinct role:
   - A **telemetry dashboard** giving the platform team visibility into which application repos are on which contracts/shared-config/framework versions — the concrete implementation of ARCH-2026-03 §6's "telemetry tracking which applications still call" a given capability or version.
   - **Automated update PRs** (a bot that opens a PR bumping an application's contracts/shared-config dependency whenever a new compatible version publishes, auto-merged if CI passes) — keeps the common case low-friction so most applications never approach the edge of the support window at all.
   - A **hard CI gate** on each application's own deploy pipeline that refuses to ship if its contracts or framework version has fallen outside the bounded support window (current major + previous, per the Decision 001 addendum and ARCH-2026-03 §6) — the mechanism that makes the bounded window an enforced limit rather than a documented policy.

**Rationale.**
- The registry decision makes ARCH-2026-02 §5 (deletion test) and §6 (addition test) mechanically true simultaneously, with meaningfully less infrastructure than a backend registry service — consistent with this log's recurring principle (first applied in Decision 006 against the bootstrapping-portal option) of not building a stateful service where a versioned static artifact suffices.
- The empty-shell gate falls out of the registry decision almost for free, rather than requiring bespoke test infrastructure — a sign the registry decision was the right one to settle first.
- Layering all three currency mechanisms reuses this log's standing rule (stated plainly as far back as Decision 001's own trade-off framing) that a rule without CI enforcement has a one-deadline shelf life: telemetry alone informs, automation alone doesn't guarantee compliance, and a gate alone without automation would make routine version bumps unnecessarily painful for application teams. Together they cover awareness, low-friction compliance, and a hard backstop.

**Trade-offs / risks.**
- The manifest artifact and its CDN become a real (if narrow) operational dependency: if publishing is broken or the CDN is unavailable, no *new* application can be discovered, though already-mounted applications in active sessions are unaffected since Mount already occurred.
- The automated-PR bot and the hard CI gate both require real engineering investment to build and maintain — this is now committed infrastructure, not optional tooling, since Decision 006's scaffolding already assumes staleness detection exists.
- The hard gate must be scoped precisely to "outside the bounded window," never to "not on the latest version" — over-tightening it would recreate the exact lockstep-upgrade tax ARCH-2026-03 §6 and the Decision 001 addendum both deliberately rejected.

**Future implications.** The manifest repository's governed publish step is the concrete mechanism ARCH-2026-02 §6 refers to as "an entry in the central entitlement-to-application map, which is governance metadata reviewed by whoever owns access policy" — future decisions or onboarding documentation should point to this pipeline directly rather than describing it abstractly.

---

### Decision 008 — Testing Strategy Across a Plugin Architecture

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** Native Federation (Decision 001) combined with independent repos (Decision 002) creates a testing risk ordinary single-bundle Angular testing doesn't have: an application's tests can all pass in complete isolation against mocked contracts, while the actual integrated system — shell and application, independently built and only meeting at runtime via a federation boundary — is broken. Standard unit testing cannot structurally catch this; a dedicated layer is required to verify the shell and every application actually agree on the published contract (Decision 003), both in shape and in runtime behavior, without re-introducing a full-integration-test cost across all 75 applications on every change.

**The testing stack, by layer.**

| Layer | What it verifies | Structural blind spot |
|---|---|---|
| Unit tests (per repo) | Internal logic correctness in isolation | The boundary itself — a test mocking the contracts package proves correctness against the mock, never against the real shell |
| Type-checking against published contracts (Decision 003) | Structural/shape compliance | Behavioral drift — a value can match its declared type while no longer behaving as documented (e.g., an Observable that stops emitting) |
| **Consumer-driven contract tests** | Behavioral compliance, across **all** consuming applications | Full end-to-end mount/render/lifecycle behavior in a real browser |
| **Cross-boundary integration tests** | Real mount, render, and lifecycle transitions (ARCH-2026-03 §2) between the shell and a real built application bundle | Breadth — deliberately scoped to a curated subset, not exhaustive across all applications, to avoid recreating a platform-team bottleneck |
| Empty-shell CI gate (Decision 007) | The shell has zero hard dependency on any application existing | Nothing about applications — shell-only, already ratified |

**Options considered — integration test ownership and scope.**

| Option | Verdict |
|---|---|
| Application-side only (each app tests itself against a pinned shell version; shell runs no cross-application integration testing) | Rejected — the shell could ship a change breaking several applications simultaneously with nothing catching it until each affected application's own pipeline happens to run |
| Centralized (a platform-owned suite integration-tests every one of the 75 applications against every shell change) | Rejected — cost scales directly with application count and recreates the platform-team bottleneck already rejected in Decisions 005 and 006 |
| **Shell-side, curated set**: the shell's own pipeline integration-tests against a small, deliberately chosen set of pinned application builds on every shell change; application teams separately run the equivalent test against a pinned shell version before their own deploys | **Selected** |

**Options considered — closing the curated set's coverage gap.**

| Option | Verdict |
|---|---|
| Type-checking + curated integration set only | Rejected as insufficient alone — behavioral (not merely structural) contract drift in the ~70 non-curated applications would go undetected until those applications' own pipelines run, or until production |
| **Consumer-driven contract testing** — each application publishes a lightweight expectations artifact; shell CI verifies it satisfies the union of all published expectations before every release | **Selected** |

**Decision.** The platform runs a five-layer testing stack: (1) ordinary unit tests per repo; (2) type-checking against the published, versioned contracts packages (Decision 003); (3) **consumer-driven contract tests**, verified in the shell's CI against the union of every application's published expectations before release; (4) **cross-boundary integration tests**, run in the shell's pipeline against a small curated set of pinned real application builds, and separately by each application team against a pinned shell version before their own deploys; (5) the empty-shell CI gate already ratified in Decision 007.

**Rationale.**
- No single layer is a substitute for another — each closes a gap the others structurally cannot, mirroring the tiered-coverage logic already used for the singleton dependency policy (Decision 001 addendum) and currency enforcement (Decision 007).
- Consumer-driven contract testing gives breadth (all 75 applications) cheaply, since it requires no application bundle to be built or mounted — just declared expectations checked against the shell's actual behavior — while curated integration testing gives depth (real mount/render/lifecycle verification) for a deliberately bounded set.
- Shared ownership of integration testing (shell tests against a curated set; each application tests against a pinned shell version) means a regression can be caught from either direction, without requiring either side to test the full combinatorial space alone.

**Trade-offs / risks.**
- Consumer-driven contract tests require application teams to actually author and maintain accurate expectation artifacts — a team that lets its expectations go stale gets a false sense of protection, the same risk any contract-testing approach carries.
- The curated integration set requires periodic, deliberate re-evaluation of which applications belong in it (e.g., highest-traffic, most contract-surface-area, or most recently onboarded) — an assumption a set curated once at platform launch and never revisited will drift out of relevance as usage patterns shift over the platform's 10-year horizon.
- Five layers is real testing infrastructure to build and maintain — this is treated as necessary cost given the specific risk a federated, independently-deployed architecture introduces, not testing for its own sake.

**Future implications.** The scaffolding generator (Decision 006) should generate a new application repo with a starter consumer-driven contract test and the pinned-shell-version integration test wired in by default, so a new application team gets this stack for free rather than having to build it from a blank page.

---

### Decision 009 — Observability & Error-Reporting Implementation

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** ARCH-2026-02 §2 assigned the shell an outer, fatal error boundary and left each application's inner, recoverable error handling to that application; ARCH-2026-05 §6 specified what the user experiences in each case. Neither addressed the support/SRE side of that boundary: whether a single user session — potentially spanning the shell plus several independently-built, independently-deployed applications across Mount/Unmount cycles (ARCH-2026-03 §2) — produces one coherent, correlatable timeline, or disconnected logs in as many tools as there are application teams. This is the frontend analogue of the distributed-tracing problem in backend microservices, and it is real here for the identical structural reason: applications are independently built and deployed (Decisions 001, 002).

**Options considered — centralization model.**

| Option | Verdict |
|---|---|
| Fully decentralized (each application team picks its own observability vendor independently) | Rejected — recreates the "duplicated cross-cutting concern" failure this log has already rejected in Decisions 001, 004, 005, and 006, and specifically breaks the ability to correlate an incident spanning application boundaries |
| Fully centralized (all reporting, including internal team diagnostics, mandated through the shell) | Rejected as reaching further than necessary — mandates shell tooling even for a team's own private, non-cross-cutting debugging needs, past the boundary ARCH-2026-02 §2 and Decision 004 already drew between shell-owned mechanism and application-owned internals |
| **Hybrid** — mandatory shell-owned baseline (errors, key lifecycle events, a shared correlation id) that every application reports through; teams may additionally layer their own supplementary internal-only tooling | **Selected** |

**Options considered — instrumentation foundation.**

| Option | Verdict |
|---|---|
| Direct vendor SDK integration (wrap one chosen vendor's proprietary SDK inside the shell's API) | Rejected as the default — locks the platform's instrumentation model to one vendor's data model; a future vendor change would require re-instrumenting every application rather than re-pointing an exporter |
| **OpenTelemetry-based** (the shell's Service API wraps an OTel SDK/exporter; backend vendor is swappable behind it) | **Selected** |

**Decision.** Observability/error-reporting is added as a new capability on the **Shell Public API** (extending the table already ratified in ARCH-2026-03 §4, alongside Notifications, Toasts, and Dialogs): applications supply error and event content; the shell owns transport, correlation-id stamping, and delivery to the backend. The outer fatal error boundary (ARCH-2026-02 §2) and each application's own inner recoverable boundary both report through this identical API, distinguished by severity/scope tags rather than by separate mechanisms. The shell's implementation is built on **OpenTelemetry**, with the actual backend vendor (Datadog, Sentry, an internal collector, or otherwise) plugged in behind an exporter, never referenced directly by application code. Application teams may additionally integrate their own supplementary tooling for internal, non-cross-cutting diagnostics, provided the mandatory baseline reporting is also present.

**Rationale.**
- Reuses the Service API mechanism ARCH-2026-03 §3/§4 already ratified rather than inventing a new communication model — "application asks shell to do something for it" is already an established, always-permitted direction.
- The hybrid model guarantees the one case that actually matters for incident response — a coherent, correlated cross-application timeline — is always true, while respecting the same shell-mechanism/application-content boundary this log has applied consistently since Decision 004.
- Building on OpenTelemetry rather than a specific vendor SDK is the same "bet on ecosystem direction, stay swappable" reasoning already applied to Native Federation in Decision 001 — the backend vendor becomes an implementation detail behind the shell's API, not a platform-wide commitment baked into 75 application codebases.

**Trade-offs / risks.**
- Every application must adopt the shell's observability API for baseline reporting, which is a real, if small, integration cost at onboarding — mitigated by the scaffolding generator (Decision 006), which should wire this in by default for new applications.
- OpenTelemetry's frontend/RUM tooling is less mature than its backend-service ecosystem; this should be re-validated before the first application team onboards, the same "recheck ecosystem maturity before committing teams to it" caveat already applied to Native Federation in Decision 001.
- The correlation id and context-stamping logic (session, active application, tenant, workspace — ARCH-2026-03 §1) is now itself load-bearing shared infrastructure and must be treated with the same rigor as any other true singleton concern named in ARCH-2026-02 §2.

**Future implications.** The scaffolding generator (Decision 006) should wire the OpenTelemetry-based reporting client in by default for new applications. A remediation/on-call ownership model for what happens when the observability pipeline itself degrades is not resolved by this decision and should be addressed alongside the shell rollout/rollback strategy already queued in this log's roadmap.

---

### Decision 010 — Authentication & Session Implementation Approach

**Status:** Ratified
**Decided:** 2026-07-23

**Problem.** ARCH-2026-02 §2 already ratified that the shell alone terminates and refreshes sessions and owns idle timeout/cross-tab logout; ARCH-2026-03 §1 already classified Identity as fixed-at-boot and Session as a live state machine; ARCH-2026-05 §6 already specified the user experience at Session Expiring/Expired. None of that fixed the actual mechanism — and one part of that mechanism interacts directly and dangerously with Decision 001. Native Federation was chosen specifically to preserve continuity (ARCH-2026-05 §7), which means every application executes in the shell's own origin and JS realm with no sandbox — already accepted and mitigated for supply-chain risk in the Decision 001 security addendum. That addendum did not address a second consequence of the same trade-off: if the shell holds the user's raw auth token anywhere a same-realm application's JS can read it, any one of 75 independently-built codebases — compromised or not — becomes a credential-theft vector, undermining the SRI/allowlist/SCA controls just ratified.

**Options considered — token storage and exposure.**

| Option | Verdict |
|---|---|
| Bearer token in localStorage/sessionStorage, read directly by applications | Disqualified — directly contradicts the risk posture just established in the Decision 001 security addendum; any application's JS can read the token at any time, a well-documented theft vector this platform specifically cannot afford given its same-origin federation model |
| In-memory token only, never persisted, never exposed via a public API | Rejected as insufficient alone — meaningfully reduces exposure versus storage-based tokens, but does not fully close the risk, since same-realm applications could still attempt active interception (e.g., monkey-patching `fetch`) as the token is attached to outgoing requests |
| **BFF (Backend-for-Frontend) pattern with httpOnly, Secure, SameSite session cookies** — the raw token never enters JS-accessible storage or memory at all | **Selected** |

**Options considered — identity protocol.**

| Option | Verdict |
|---|---|
| Fully custom/proprietary authentication scheme | Disqualified outright — reinvents an already well-solved problem and introduces needless risk for no benefit at this scale |
| OIDC only, no SAML support | Rejected as the sole path — simpler, but risks a real enterprise prospect whose identity provider only speaks SAML becoming unonboardable, or forcing a rushed one-off integration later under sales pressure |
| **OIDC as the primary, mandatory protocol; SAML supported as a secondary compatibility path** for legacy enterprise identity providers | **Selected** |

**Decision.**
1. **Token storage.** Authentication is implemented via a **Backend-for-Frontend (BFF)**. The BFF terminates the actual OIDC/SAML flow with the customer's identity provider and issues the browser an **httpOnly, Secure, SameSite session cookie**. The raw access/refresh token is held entirely server-side and never enters any JS-accessible storage or memory, in the shell or in any application. Applications never receive or handle the raw token; they consume only the resolved identity/claims exposed by the shell (ARCH-2026-03 §1, Decision 004's fixed-at-boot value for Identity) and make API calls that carry the cookie automatically.
2. **Identity protocol.** **OIDC is the mandatory default** for every new customer/identity-provider integration. **SAML is supported as a secondary path** in the BFF specifically for legacy enterprise identity providers that do not speak OIDC.

**Rationale.**
- The BFF pattern is the only option among those considered that structurally closes, rather than merely reduces, the credential-theft risk created by Decision 001's same-origin trade-off — there is no token value for any application's JS to read, because it never exists in a place JS can reach. This directly extends the risk posture the Decision 001 security addendum already established rather than leaving a gap next to it.
- Session state (active, idle-warning, expiring, expired — ARCH-2026-03 §1) remains a shell-owned live value exposed to applications as an Observable, per Decision 004 — the BFF changes *where the credential lives*, not the already-ratified contract for how session state is communicated across the federation boundary.
- OIDC-primary matches the modern, dominant standard with mature tooling and native support from every major enterprise identity provider; SAML-as-secondary keeps the platform onboardable for large, legacy-IdP enterprise customers without making SAML the default engineering path every new integration must reason about.

**Trade-offs / risks.**
- The BFF is genuine backend infrastructure, not a frontend-only concern — it must be scoped, resourced, and operated with the same rigor as any other platform-critical service, and every backend API the platform's applications call must accept cookie-based session validation rather than expecting a bearer token.
- Supporting two identity protocols (OIDC and SAML) means the BFF carries two integration code paths to maintain and test — an accepted cost of enterprise-customer onboardability, not an oversight.
- Tenant, identity, and impersonation remain governed exactly as ARCH-2026-03 §1 already ratified: tenant and identity are fixed-at-boot (a change is a hard context switch, never a soft update), and impersonation remains a separately audited operation with the unmistakable, persistent indicator ARCH-2026-05 §6 already requires — this decision implements the mechanism underneath those rules, it does not alter them.

**Future implications.** Deep-linking's requirement to "re-establish full context before resolving anything" and "re-check entitlement at resolution time" (ARCH-2026-04 §8) is implemented against the BFF-issued session cookie — a stale or expired cookie triggers the Session Expired flow (ARCH-2026-05 §6) with the original destination preserved, exactly as ARCH-2026-04 §8 already requires. The observability addition in Decision 009 should tag authentication failures and session-expiry events distinctly, since these are common, expected support-inbound scenarios rather than fatal errors.

---
*Platform Architecture Review Board · ARCH-2026-06 · Implementation decision log — entries accumulate as each subsystem is resolved.*
