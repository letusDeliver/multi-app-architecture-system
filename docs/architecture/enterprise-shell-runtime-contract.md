# The Enterprise Shell — Runtime Contract

**Doc ID:** ARCH-2026-03 · Companion to ARCH-2026-01 (Angular Architecture) and ARCH-2026-02 (Shell Charter)
**Issued by:** Platform Architecture Review Board
**Status:** Ratified
**Scope:** How an application lives inside the shell at runtime — ownership of runtime state, lifecycle, communication, the shell's public surface, extension mechanics, versioning, and governance. No implementation, no framework, no UI.

> **Reading note.** ARCH-2026-02 established *what* the shell is responsible for and the build-time dependency boundary between shell and applications. This document is its runtime counterpart: given that boundary, how does a running application actually behave inside the shell from the moment it's discovered to the moment it's disposed, and how do a dozen simultaneously-running applications coexist without ever referencing each other directly. Angular, module federation, and component design are out of scope here by design — this contract must hold regardless of what implements it.

---

## 1. Runtime Ownership

Before anything else, every runtime context an application might need has to be assigned an owner and a mutability class. Getting this wrong is the single most common source of subtle, hard-to-reproduce bugs in a multi-application shell — a context that two layers believe they own will eventually be written by both, and a context treated as static that actually changes mid-session will eventually be read stale.

### Ownership and mutability, by context

| Runtime context | Owner | Mutable at runtime? | Reasoning |
|---|---|---|---|
| **Identity** (authenticated principal, claims, profile) | Shell | Effectively no — the credential is refreshed transparently, but the principal itself only changes via re-authentication | Must be resolved once, before any application mounts, and handed down as trusted input. If an application could mutate identity, no other application could trust it. |
| **Tenant** (the technical data-isolation boundary) | Shell | No, by default | Tenant defines *which database/partition* every request is scoped to. Changing it mid-session is architecturally equivalent to logging into a different account and must be treated as a hard context switch (reload), not a soft runtime update. Support/impersonation tooling that crosses tenants is a distinct, separately audited operation — never a casual runtime switch. |
| **Organization** (the legal/billing entity — may be 1:1 or N:1 with Tenant depending on the product) | Shell | No | Same reasoning as Tenant: it's identity-adjacent, resolved at authentication, and changing it means re-establishing the session. |
| **Workspace** (a sub-scope inside a tenant — a project, a department, a board) | Shell owns the *mechanism* and the switch operation; applications define what a workspace *means* to them | Yes — frequently | Workspace switching is a first-class, common runtime operation that cascades: it re-scopes API calls, permissions, and feature-flag targeting for every mounted application simultaneously. It must be centrally coordinated (Shell Charter §2) but its meaning is domain-specific, so ownership of the *concept* is split from ownership of the *content*. |
| **Locale** (language, formatting) | Shell | Yes | A user preference that must propagate live to every mounted application without a reload. |
| **Timezone** | Shell | Yes | Same class as Locale — a live-changeable preference every application must render dates/times against. |
| **Feature Flags** | Shell owns the evaluation mechanism and single source of truth; application teams own the definitions of their own flags | Yes — including mid-session flips (kill switches, progressive rollout) | Flags must be evaluated once, consistently, against one identity/tenant/workspace targeting context — not re-derived per application. Because flags can flip live (an incident kill-switch), they must be exposed as a live, subscribable contract, never a one-time snapshot taken at boot. |
| **Environment** (dev/staging/prod, region, build/version) | Shell | No | Resolved once at boot from deployment configuration. Changing environment at runtime has no meaningful definition — it requires a new deployment, not a state transition. |
| **Session** (auth session state: active, idle-warning, expiring, expired) | Shell | Yes — this is inherently a state machine | Idle timeout and token refresh must be centralized (Shell Charter §2) or every application ends up running its own competing timer. |
| **Permissions** (evaluation mechanism and coarse entitlement) | Shell owns the mechanism and coarse (app-visibility) layer; applications own fine-grained, domain-specific permission content | Yes | A permission grant or revocation can happen elsewhere in the system (an admin action in another tab, another session) and must be reflected without requiring a reload — permissions are a live contract, not a point-in-time snapshot. |
| **Preferences** (settings a user has chosen) | Shell owns global/cross-cutting preferences (theme, density, notification settings) and the persistence mechanism; applications own their own domain-specific preferences (e.g., default view mode) | Yes, by definition | Splitting ownership prevents the shell from having to understand every application's settings, while still giving every application a single, shared way to persist preferences instead of each inventing its own storage.

### The two classes, restated

Everything above falls into exactly two buckets, and this binary is the operative rule to remember rather than the sixteen individual rows:

- **Fixed-at-boot contexts** — Identity, Tenant, Organization, Environment. Resolved once, before any application mounts, and never mutated in place for the lifetime of the session. Changing any of these is equivalent to starting a new session, not updating the current one.
- **Live contexts** — Workspace, Locale, Timezone, Feature Flags, Session state, Permissions, Preferences. These can and do change while applications are mounted and active, and must therefore be exposed to applications as a subscribable, continuously-current contract — never as a value read once at Initialization and cached by the application. An application that snapshots a live context at startup and never re-reads it will silently drift out of sync with reality the first time that context changes mid-session.

> **Rule.** No application may treat a live context as fixed for convenience. If a context is classified live in the table above, every application consuming it must be built to react to it changing at any time, including while the application is mounted and active.

---

## 2. Application Lifecycle

An application hosted in the shell moves through a defined sequence of stages from the moment the shell becomes aware it exists to the moment every trace of it is released from memory. Most of an application's life is spent cycling through the middle stages (Active/Inactive) many times; the outer stages (Discovery through Disposal) typically happen once per session, if at all.

### The stages

```
Discovery → Registration → Permission Evaluation → Navigation Registration
   → Initialization → Mount → [ Active ⇄ Inactive ⇄ Suspend ⇄ Resume ] → Unmount → Disposal
```

The bracketed middle section is not linear — an application can cycle between Active and Inactive an unbounded number of times, and only a fraction of sessions will ever push a given application through to Unmount, let alone Disposal.

| Stage | Trigger | Shell responsibility | Application responsibility |
|---|---|---|---|
| **Discovery** | Shell boot, or a manifest refresh | Read the application registry/manifest source and learn what applications exist. No application code is loaded — this is metadata only. | None — the application has no code running yet. |
| **Registration** | Immediately following Discovery, per manifest entry | Validate the manifest entry against the schema and the currently supported contract version(s) (§6); add it to the live registry if valid. | Publish and maintain an accurate manifest entry as its only input to this stage. |
| **Permission Evaluation** | After Registration, per entry, per authenticated session | Check the entry's declared required entitlement against the current identity/tenant/workspace. Applications that fail this check proceed no further — they are never initialized, mounted, or loaded. | None — this stage evaluates shell-known coarse entitlement, not application logic. |
| **Navigation Registration** | Immediately after passing Permission Evaluation | Add the application's nav entry (icon, label, route prefix) to the navigation model. Still metadata only — no application bundle has been fetched. | None. |
| **Initialization** | The user activates the application for the first time in the session (typically first navigation to its route prefix) | Fetch/load the application's runtime bundle; inject the current runtime context (§1) as read-only input. | Perform its own startup using the injected context; establish whatever internal state it needs before it can be mounted. |
| **Mount** | Immediately following successful Initialization | Attach the application's root into the designated content region and make it visible. | Expose a mount function conforming to the plugin contract; begin rendering. |
| **Active** | The application is the current foreground application | Deliver live-context updates (§1) as they occur; route commands/events (§3) addressed to it. | Subscribe and react to live-context changes; behave as the user's current focus. |
| **Inactive** | The user navigates to a different application, but this one is retained rather than torn down | Decide retention policy based on a memory/resource budget. | Pause non-essential background work (polling, timers) while retained; must not assume it is invisible-but-fully-running. |
| **Suspend** | Explicit shell signal, typically under resource pressure or for background/hidden tabs | Issue the suspend signal and track that the application has shed resources. | Release non-critical resources (cancel in-flight polling, pause subscriptions specific to it) while preserving enough state to resume without a full reinitialization. |
| **Resume** | The application becomes relevant again after being suspended | Issue the resume signal and re-supply current context. | Re-establish what was shed at Suspend, using the same contract it used at Initialization — never a full cold start if avoidable. |
| **Unmount** | The user navigates away and retention policy elects not to keep the application warm, or the application is being torn down deliberately | Detach the application's root from the content region; deregister all of its contributions (§5) automatically. | Run its own cleanup: cancel requests, release subscriptions, flush anything that must not be lost. |
| **Disposal** | The application is removed from the manifest, or the shell reclaims memory by releasing a loaded module | Fully release the loaded module/bundle so it can be garbage-collected; purge the registry entry if the application was removed, not merely navigated away from. | None — the application no longer exists in memory by this point. |

> **Rule.** Automatic deregistration of every contribution an application made (§5) is mandatory at Unmount, without exception. An application that has been unmounted must leave zero trace in the shell's shared surfaces — no orphaned header action, no stale search provider, no dangling keyboard shortcut. This is what makes the deletion test in ARCH-2026-02 §5 true not just at build time but at runtime.

---

## 3. Runtime Communication

**Applications must never hold a reference to another application's instance, module, or internal state.** This is the runtime analogue of ARCH-2026-02 §4's build-time rule that features never import each other's source — the same principle, enforced against the running system instead of the dependency graph. Every cross-application interaction is mediated by the shell.

### The four mechanisms, and where each belongs

**Contracts** are not a communication channel; they are the precondition for the other three being safe. A contract is a published, versioned description of a payload shape — what an event carries, what a command expects as input and returns as output, what a service API accepts. Without a shared, versioned contract, events and commands degrade into undocumented, stringly-typed payloads that break silently the moment one side changes shape. Every mechanism below is typed against a contract; none of them are safe without one.

**Events** — broadcast, fire-and-forget, one-to-many, no return value expected, publisher indifferent to who (if anyone) is listening.

- *Use for:* announcing that something happened — a notification was created, the workspace changed, a record was modified elsewhere. Cross-cutting notification-of-fact is the default case and should be the most common mechanism used.
- *Advantage:* maximum decoupling. The publisher never knows or cares who subscribes; new subscribers can be added later with zero change to the publisher.
- *Trade-off:* no delivery guarantee and no response — you cannot use an event to ask another application to do something and know whether it happened. Event payload shape is itself a contract that must be versioned (see §6). Left ungoverned, a shared event bus degenerates into "event soup," where causality across a dozen simultaneously-listening applications becomes nearly impossible to trace during an incident.

**Commands** — directed, one sender to one resolved handler, expects an outcome or acknowledgment.

- *Use for:* explicit cross-application requests that need a guaranteed effect or response — "open this record in another application," "request navigation to X."
- *Advantage:* explicit intent and traceable causality; a command either succeeded, failed, or wasn't handled, and the sender can react to which.
- *Trade-off:* commands introduce a sender-to-handler coupling that must be mediated — resolved by the shell's registry, never by holding a direct reference to a handler. Command types must be deliberately scarce and explicitly registered; multiplying command types without discipline quietly reconstructs a hidden RPC mesh between applications, which is exactly the coupling this whole model exists to prevent. Every new command type is a governance event (§7), not a routine addition.

**Service APIs** — application calls shell directly; one-directional, application → shell only.

- *Use for:* everything in §4 below — showing a toast, registering a search provider, requesting a workspace switch. This is not application-to-application communication at all; it is application-to-shell, which is always permitted because the shell is the one dependency every application is allowed to have.
- *Distinction to hold onto:* if the interaction is "app asks shell to do something for it," it's a Service API, not a Command. Commands and Events are for app-to-app interaction mediated through the shell; Service APIs are for app-to-shell interaction, a fundamentally different and always-safe direction.

### The recommended layered model

1. **Contracts** underpin everything — every event, command, and service API is typed against a published, versioned shape.
2. A shell-hosted, shell-mediated **Event Bus** is the default mechanism for cross-application awareness — loosely coupled, broadcast, no response expected.
3. A shell-hosted **Command Channel** exists for the narrower set of cases that genuinely need a directed request/response between applications — used sparingly, with every command type explicitly registered and reviewed, because unlike events, commands reintroduce a coupling relationship that must be kept small and deliberate.
4. **Service APIs** (§4) handle everything that is fundamentally a capability request from an application to the shell, rather than one application talking to another.

> **Rule.** No application may import, instantiate, or hold a reference to another application's code at runtime, under any circumstance. All cross-application interaction — without exception — passes through the shell's event bus, command channel, or a published contract. If two application teams find themselves needing a direct integration that neither the event bus nor the command channel comfortably expresses, the correct escalation is a new governed contract (§7), never a workaround reference.

---

## 4. Shell Public API

The shell exposes a fixed set of capabilities that every application consumes identically. In every case below, **the shell owns the rendering surface and the interaction chrome; the application owns only the content or intent it pushes through the API.** None of these let one application reach another — they only let an application talk to the shell, which is always a permitted direction. What follows is the contract each capability represents, not its implementation.

| Capability | What the application supplies | What the shell owns |
|---|---|---|
| **Notifications** | A notification's content — title, body, severity, optional action reference | Delivery, in-session persistence, badge/unread count, the single notification center UI |
| **Breadcrumbs** | The active application's current trail (an ordered list of label + navigation-target pairs), replaced wholesale on each internal navigation | Rendering the trail in the chrome; only the currently-active application's breadcrumbs are ever shown |
| **Document Title** | A title segment for its current view | Composing the final title with the suite-level brand suffix, so the format stays consistent across every application |
| **Global Search Registration** | A search provider: given a query, return results in a shell-defined result shape | Aggregating and rendering results from every registered provider when a global search runs; applications never render their own search UI |
| **Quick Actions** | A set of context-aware actions (label, handler reference, required entitlement) | The quick-action surface itself, and filtering by entitlement without needing to ask the application again at render time |
| **Command Palette** | Nothing registered directly — the palette surfaces contributions already registered elsewhere (Quick Actions, Header Actions, navigation targets) | Aggregation, ranking, fuzzy-matching, and rendering; a single contribution is never registered twice for two different surfaces |
| **Workspace Switching** | A request to switch to a specific workspace | Executing the switch and broadcasting the resulting live-context change (§1) to every mounted application |
| **Dialogs** | Content to render and a result contract (what value, if any, the dialog resolves with) | Focus-trapping, stacking order, dismissal behavior, and the outer modal chrome — one consistent modal experience suite-wide |
| **Toasts** | Message, severity, and duration | The single toast host and its rendering/queuing behavior |
| **Loading Indicators** | A "busy" signal, typically during a route transition | Rendering the actual indicator (progress bar, spinner) consistently across every application |
| **Progress** | Quantifiable progress for a longer-running operation (percentage or step count) | A shell-owned progress surface (e.g., a progress tray), so applications never build bespoke progress UI |
| **Theme** | Nothing — read-only consumer | The current theme (tokens, light/dark mode) as a live, reactive value; applications may not define or override shell theme tokens |
| **Environment** | Nothing — read-only consumer | Environment, region, and build/version metadata as a resolved-once value (§1) |

> **Rule.** If a proposed shell capability would require an application to render its own version of that capability's chrome (its own toast, its own modal, its own progress bar) "just this once," the correct fix is to use the existing shell API, not to add a parallel implementation. A second implementation of any capability in this table is a direct violation of ARCH-2026-02 §2's "exactly one implementation" principle.

---

## 5. Extension Points

An extension point is how a hosted application safely contributes to a shared shell surface **without modifying shell code** — the runtime, finer-grained expression of the plugin-hosting principle established in ARCH-2026-02. Every extension point works the same way: the application calls a shell registration API with a description of its contribution; the shell decides how, where, and whether to render it. An application never injects code, markup, or a direct reference into a shell-controlled render tree.

### Principles that apply to every extension point

1. **Registration, not injection.** A contribution is always a data/description payload (label, icon reference, handler or command reference, required entitlement) — never a direct code or template injection into a surface the shell controls. This is what lets the shell keep every contribution visually and behaviorally consistent regardless of which team authored it.
2. **Lifecycle-scoped, automatically.** Every contribution is tied to the lifecycle of the application that registered it (§2). At Unmount, every contribution that application made is deregistered automatically. Extensions must never outlive the application that created them — an orphaned contribution is a defect, not a quirk.
3. **Entitlement declared at registration.** Every contribution declares the entitlement required to see or use it at registration time, so the shell can filter without re-querying the application at render time.
4. **Namespaced to prevent collisions.** Every contribution is namespaced to its owning application's id. Two applications independently registering the same shortcut key or the same status-bar widget id is an expected occurrence across a dozen teams, and it must be caught — surfaced as an explicit registration-time conflict in non-production environments — rather than silently resolved by whichever registered last.
5. **Register once; the shell decides where it surfaces.** A Quick Action, once registered, should also be discoverable through the Command Palette without a second registration. Requiring applications to register the same contribution once per surface multiplies governance overhead and invites the two registrations drifting out of sync.

### The specific extension points

- **Header actions** — an icon/label/handler contribution rendered in the global header's contribution zone, ordered by a priority hint, deregistered on unmount.
- **Navigation** — a two-tier extension point: the top-level nav *entry* is a structured, shell-validated registration (ARCH-2026-02 §6); everything beneath an application's own route prefix is an internal tree entirely opaque to the shell.
- **Search providers** — a registered query-in/results-out capability (§4); ranking and blending of results across providers is shell-owned to keep result ordering fair rather than left to competing providers.
- **Notifications** — applications are producers only; there is no notification *extension point* beyond producing events into the shell's single notification center, and no application should attempt to render its own notification widget.
- **Keyboard shortcuts** — a registered binding + handler + scope (global vs. active-application-only); the shell owns global conflict resolution and refuses registration of any shortcut reserved for shell-level use (e.g., the command palette's own invocation key).
- **Context menus** — content an application renders inside its own region may have its own context menu entirely internally, with no shell involvement. Where a shell-supplied shared surface (e.g., a common data grid from the design system) exposes a context-menu extension point, contributions go through the same registration contract as header actions.
- **Status bar** — a persistent, low-emphasis shell-owned strip into which applications register small status widgets (e.g., a sync indicator), under the same scoping and entitlement rules as header actions.
- **Command palette** — not a separate registration surface; every quick action, nav target, and header action registered elsewhere is automatically eligible to appear here, per the "register once" principle above.
- **Global widgets** — small, persistent UI fragments an application contributes to a shell-designated shared area (e.g., a unified home screen), registered as a widget descriptor plus a data-fetch contract, rendered inside a shell-controlled container so sizing, spacing, and error states stay consistent regardless of which team's widget is showing.

---

## 6. Runtime Versioning

The shell and its applications must be able to ship on independent schedules for a decade without forcing a synchronized release train. The mechanism that makes this possible is that **applications version against the published contract (ARCH-2026-02 §4), never against the shell's current internal implementation.**

- **Semantic discipline.** Additive, non-breaking changes to a contract (a new optional capability, a new optional field) are minor or patch changes. Anything that removes or changes the meaning of an existing capability is major. This distinction is not cosmetic — it determines whether an existing application keeps working unmodified or must take deliberate action.
- **Bounded multi-version support.** The shell must be able to serve more than one major contract version at once in production — a defined window (for example, the current major and the previous one) — so that a slower-moving application team is not forced into lockstep with every shell release. This is the concrete mechanism, not just the stated intention, behind independent team cadence.
- **Announced deprecation, never silent removal.** A capability slated for removal must be marked deprecated for at least one full major-version cycle, with telemetry tracking which applications still call it, before it is actually removed. An unannounced breaking change to a shared contract has blast radius across every simultaneously-running application — it is categorically different from a breaking change inside one application's own code.
- **Capability negotiation at the boundary.** At Registration/Initialization (§2), an application declares which contract version(s) it was built against. The shell either serves a version-appropriate adapter or refuses to mount the application with a clear diagnostic. Failing loudly at the boundary, rather than mounting an application into an undefined runtime state, is a hard rule, not a preference.
- **Contract changes are governed, not unilateral.** Because a contract change has simultaneous blast radius across every hosted application, changing a published contract goes through the same review discipline as introducing a new extension point (§7) — never a change one team makes and merely announces after the fact.

> **Trade-off, named explicitly.** Supporting multiple contract versions simultaneously is a real, ongoing cost — the shell team maintains adapters or shims for older versions rather than a single code path. The alternative — forcing every application to track shell head — is cheaper for the platform team in isolation, but reintroduces exactly the coordinated-release tax the shell exists to eliminate. This charter chooses the bounded-support-window trade-off deliberately: a defined number of supported major versions, after which migration is mandatory, rather than pretending either cost can be avoided entirely.

---

## 7. Governance

Ownership and review rigor must scale with **blast radius and reversibility**, not with how large a change subjectively feels. A large, fully-scoped, fully-revocable contribution should move fast; a small change to a foundational contract should move slowly, regardless of line count.

### Ownership

| Asset | Mechanism owner | Content owner |
|---|---|---|
| **Navigation taxonomy** | Shell/Platform team, in consultation with a cross-team design council | N/A — shared vocabulary every application's nav entry must fit into; no single application team owns it |
| **Icons** | Design-system team | Application teams request additions through the design system's contribution process; no ad hoc icons inside an application |
| **Permissions** | Shell/Platform team owns the model/primitives (roles, claim shapes, evaluation contract) | Each application team owns the specific permissions relevant to its own domain, evaluated against the shared model |
| **Extensions** | Shell/Platform team owns the registration mechanism, scoping, and lifecycle rules | Application teams own the specific contributions they register |
| **Header contributions** | Shell/Platform team owns the contribution zone mechanism | Application teams own their specific contributed actions |
| **Search providers** | Shell/Platform team owns aggregation and ranking | Application teams own their individual provider's results |
| **Shell APIs (§4)** | Shell/Platform team, exclusively | N/A — this is the shell's own public surface; applications are consumers, not co-owners |
| **Plugin contracts** (manifest schema, lifecycle contract of §2) | Shell/Platform team, with mandatory Architecture Review Board sign-off on any change | N/A — the highest-blast-radius asset in this charter |

### Review process, by tier

- **Tier 1 — Contribution-level** (a new header action, a new quick action, a new search provider, a new icon): lightweight peer or design-system review, fast turnaround, no Review Board involvement required. Blast radius is contained to that one contribution, and it is fully and automatically revocable at unmount (§2, §5) even if it turns out to be a poor fit.
- **Tier 2 — Extension-point or navigation-taxonomy changes** (a new type of contribution point, a change to top-level nav categories): requires cross-team design/platform council review. This changes shared vocabulary or a shared mechanism, but not the core runtime contract itself.
- **Tier 3 — Contract, plugin-schema, or Shell-API changes** (anything governed by §6's versioning discipline, anything in the lifecycle of §2, the communication model of §3): requires full Architecture Review Board review and sign-off. These changes have simultaneous, suite-wide blast radius and directly affect the guarantees this charter and ARCH-2026-02 make — including the deletion test and the addition test.

> **Rule.** No asset in the ownership table above may be changed outside its assigned review tier, regardless of how urgent the request feels. Urgency is a reason to expedite a review, never a reason to skip one — a contract changed under deadline pressure without Tier 3 review is exactly the failure mode ARCH-2026-02 §7 already named as the most common way this architecture rots.

---

## Binding Principles for This Contract

*Valid for as long as applications are hosted inside this shell.*

1. **Fixed-at-boot contexts never mutate in place; live contexts are never treated as fixed.** Every runtime context is one or the other, and every application must be built accordingly.
2. **Every application contribution is automatically and fully revoked at Unmount.** No orphaned nav entries, header actions, shortcuts, or widgets may outlive the application that registered them.
3. **Applications never hold a reference to another application's code, instance, or internal state.** All cross-application interaction passes through the shell's event bus, command channel, or a published contract.
4. **Commands are deliberately scarce.** Every new command type is a governed addition, not a routine one, because commands reintroduce sender-to-handler coupling.
5. **The shell owns the rendering surface and chrome of every shared capability; applications own only the content or intent they push through it.** A second, parallel implementation of any shell capability is a defect.
6. **Every extension point is registration, never injection.** Applications describe a contribution; the shell decides how and where it renders.
7. **Applications version against the published contract, never against shell head.** The shell supports a bounded window of prior major versions so no application is forced into lockstep upgrades.
8. **No contract is changed silently.** Deprecation is announced a full major-version cycle in advance; breaking changes fail loudly at the registration boundary, never silently at runtime.
9. **Review rigor scales with blast radius and reversibility, not with how large a change feels.** Fully-scoped, fully-revocable contributions move fast; foundational contract changes always go through full Review Board sign-off, regardless of urgency.

---
*Platform Architecture Review Board · ARCH-2026-03 · Runtime contract review only — Angular implementation addressed separately.*
