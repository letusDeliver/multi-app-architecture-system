# The Enterprise Platform — Information Architecture

**Doc ID:** ARCH-2026-04 · Companion to ARCH-2026-02 (Shell Charter) and ARCH-2026-03 (Runtime Contract)
**Issued by:** Platform Architecture Review Board
**Status:** Ratified
**Scope:** How information, navigation, search, breadcrumbs, and URLs are organized across every application on the platform. No layout, no components, no CSS, no Angular.

> **Reading note.** ARCH-2026-02 defined what the shell owns; ARCH-2026-03 defined how an application lives inside it at runtime. Both assumed navigation, search, and addressing already existed as concepts without defining their shape. This document is that definition — the organizing logic every one of the 75+ future applications must fit into, regardless of what renders it.

---

## 1. Information Architecture Philosophy

Enterprise IA is usually pitched as a choice between five organizing principles. Each is real, each solves a genuine problem, and each fails badly the moment it is asked to be the *only* organizing principle.

- **Application-centric** — the top-level unit is the application (CRM, HRMS, Survey Builder…); users pick "which app" first, then work inside it. This matches how the platform is actually built and governed: application is the unit of registration, versioning, and entitlement in ARCH-2026-02/03. Its failure mode is that real work is rarely single-application — approving a leave request might touch HRMS and then Analytics — and forcing users to know which internal product owns a task creates friction that gets worse, not better, as the application count grows.
- **User-centric** — organize around "my things," a personalized landing surface. Excellent for personalization, but it is a *view*, not an architecture — it gives no stable, shareable mental model of how the platform is structured, and it doesn't scale to collaborative or shared work.
- **Task-centric** — organize around jobs-to-be-done ("approve an invoice," "onboard an employee") independent of which application implements them. Powerful for discovery, dangerous as a primary structure: tasks cut across application ownership boundaries, a canonical task taxonomy across 75 applications from 12 teams is its own governance nightmare, and tasks change far more often than applications do — building your primary hierarchy on the least stable thing guarantees constant IA churn.
- **Role-centric** — organize around who the user is (Manager, Finance, Support, Admin), surfacing only what's relevant. Reduces noise effectively, but real people hold overlapping roles simultaneously, and using role as the *primary* structure produces a combinatorial explosion of parallel, hand-maintained navigation trees that drift out of sync with each other and with reality.
- **Workspace-centric** — organize around a bounded context (a team, a department, a project) inside which relevant applications and data surface. Matches how workspace already behaves as a live, cascading context (ARCH-2026-03 §1), but a workspace alone says nothing about what's stable across workspaces — it's a lens, not a skeleton.

### The recommendation

**Application is the stable structural skeleton. Workspace is the contextual lens applied on top of it. Role and permission are filters, never a parallel structure. Task-centric discovery is an accelerant layered above all of it — never the backbone.**

Concretely: the platform's IA skeleton is built from applications, because that's the one unit that is genuinely stable and already governed (ARCH-2026-02's registration model, ARCH-2026-03's versioning discipline). Workspace scopes which of those applications and which of their data are relevant *right now*, exactly as it already scopes permissions and feature flags. Role and permission narrow visibility within that scoped view — they filter the skeleton, they do not redefine it, which is what avoids the combinatorial explosion named above. Task-centric mechanisms — search, the command palette, recommendations — exist so a user who knows *what* they want to do but not *where* it lives can bypass the skeleton entirely. At 75 applications, no user should ever need to know which application owns "request time off"; they should be able to ask for it directly.

> **Rule.** If any of the four supporting principles (user, task, role, workspace) is ever proposed as a *replacement* for the application-centric skeleton rather than a lens or filter applied to it, reject the proposal. Each failure mode above resurfaces the moment one of them is promoted to primary structure.

---

## 2. Navigation Taxonomy

The example hierarchy — Platform → Workspace → Application → Module → Feature → Page → Action — is a reasonable *conceptual addressing hierarchy*, but treating all seven levels as literal, click-through navigation is a mistake. The right question is not "how many levels exist" but "which levels does the shell need to know about, and which belong entirely to the owning application."

```
Platform      — the suite itself; arrived at, never navigated to; not a menu level
  Workspace   — contextual scope; shell-governed, live (ARCH-2026-03 §1)
    Application — the stable, registered unit; shell-governed (ARCH-2026-02/03)
      Section — an optional, thin top-level grouping within an app the shell renders as a nav entry
        Module    — application-internal organization; owned by the app team, invisible to platform IA
          Feature   — application-internal; owned by the app team
            Page      — a concrete rendered view; application-internal
              Action    — an atomic operation (create, edit, approve); a verb, not a place
```

**Should this hierarchy exist?** Yes, as an addressing and reasoning structure — it's what makes URLs (§7), breadcrumbs (§6), and entitlement scoping (ARCH-2026-03 §1) coherent. **Should all seven levels be click-through navigation?** No. Exactly three levels are shell-relevant and shell-governed: **Workspace, Application, and an optional thin Section**. Everything below Section — Module, Feature, Page — is application-internal, owned entirely by that application's team, and never appears in platform-wide navigation governance, consistent with the Shell Charter's rule that the shell owns the frame and the application owns everything inside its content region.

**Action deserves a specific callout**: it is not a place in a hierarchy at all — it's a verb. Treating "Approve" or "Export" as if it sits at the same conceptual level as "Page" is a common and damaging conflation, because it mixes the answer to "where am I" with the answer to "what am I doing." Section 11 names this explicitly as an anti-pattern.

> **Rule.** The shell reasons about roughly three levels — Workspace, Application, Section. An application's internal Module/Feature/Page structure is that team's business, never the platform's, no matter how many levels deep it goes.

---

## 3. Navigation Categories

Grouping applications (Business, Administration, Analytics, Developer, Settings, Operations…) is mandatory once the catalog grows past a handful of applications — an ungoverned flat list is unusable well before 75 apps. The design question is what should be static and what must be dynamic.

- **The taxonomy of category names is static and centrally governed.** A small, fixed, deliberately-curated list of top-level categories, changed only through Tier 2 governance (ARCH-2026-03 §7) — never invented ad hoc by an individual team shipping a new application. Twelve teams inventing their own categories independently is how you end up with six different names for the same concept.
- **Category membership is fully dynamic, computed at render time.** Which applications appear in which category is metadata on that application's registration entry (ARCH-2026-03 §2), not a hand-maintained mapping.
- **Visibility is permission-aware and workspace-aware by construction**, not by exception: an application the current user can't access, or that's irrelevant to the current workspace, is simply absent from its category — filtered before rendering, never rendered-then-hidden.
- **Categories are not role-aware as a separate taxonomy.** There is one category tree, computed the same way for everyone; role influences relevance, ordering, and emphasis within that one tree (via the personal-surface mechanisms in §4), but role never produces a structurally distinct tree. This is the direct, practical consequence of §1's rule against role-centric structure — a "Finance navigation tree" and a "Manager navigation tree" as separately maintained artifacts is exactly the combinatorial explosion being avoided.

---

## 4. Navigation Behavior

Six discovery mechanisms were proposed; they don't all deserve equal, separate status.

| Mechanism | Signal type | Recommendation |
|---|---|---|
| **Pinned** | Explicit, user-chosen | Keep. The highest-confidence signal — a user deliberately placed this here. Deliberately scarce by design; if everything is pinned, nothing is. |
| **Favorites** | Explicit, user-chosen | **Do not ship alongside Pinned.** They solve the identical problem and users cannot reliably explain the difference between "my favorites" and "my pinned items." Collapse to one explicit-intent mechanism. |
| **Recent** | Implicit, recency-based | Keep. Enables fast context resumption — "I was just in this five minutes ago" — a fundamentally different need than frequency. |
| **Frequently Used** | Implicit, frequency-based | Keep, as a complement to Recent, not a duplicate of it. An application used every Monday morning should rank highly even on a day it hasn't been opened yet — recency and frequency are genuinely different signals. |
| **AI Recommended** | Inferred/predictive | Keep, but always visually distinguished from explicit and implicit-personal signals, always explainable ("why am I seeing this"), and always dismissible. An enterprise platform recommending an application the user is technically entitled to but has never touched can read as a trust or privacy misstep if it isn't transparent about being a guess. |
| **Search** | On-demand, exhaustive | Keep as the universal fallback — see §5. The one mechanism that must never fail to find something the user has access to. |

**Confidence ordering for what a user sees by default**: Pinned (explicit) → blended Recent/Frequent ("your regular tools") → clearly-labeled AI Recommended → full category browse → Search as the always-available last resort. Higher-confidence, user-authored signals always outrank inferred ones in default prominence.

---

## 5. Search Strategy

Global search must be federated across the same registration mechanism defined in ARCH-2026-03 §4/§5 — every application supplies its own results through one registered provider contract; the shell owns aggregation, ranking, and rendering.

### Result categories

| Category | Source | Notes |
|---|---|---|
| Applications | The application registry | Matched by name and known aliases; always eligible regardless of query specificity. |
| Pages / Records | Each application's registered provider | The deepest and most valuable category, and the hardest to get right — a specific Contact, a specific Invoice. |
| Commands / Actions | The command palette registry (ARCH-2026-03 §4) | Verbs, not places — "Create a new survey," "Approve pending requests." |
| People | A single canonical identity/directory provider | Must not be duplicated by every application that happens to have a "created by" field — one source of truth for who a person is. |
| Reports / Analytics | Treated as Records of the Analytics application | Structurally identical to any other application's records; may warrant distinct visual treatment given how frequently it's sought, but not a separate architectural category. |
| Settings | Both platform-level (shell) and per-application settings | Must be clearly labeled which is which — "Settings" is one of the most overloaded words in enterprise software and is named explicitly as a risk in §11. |
| Help | A distinct help-center provider | Ranked lowest by default unless an explicit help-seeking signal is present. |

### Ranking philosophy

A single relevance score across everything is not enough at this scale; rank in tiers:

1. **Exact or near-exact name matches** rank highest — a user typing a known application or command name wants it immediately, not buried under content matches.
2. **Personal-signal boost** — results intersecting the user's Pinned/Recent/Frequent set (§4) outrank equally-relevant but unfamiliar results. Personalization refines relevance; it never replaces it.
3. **Provider-supplied relevance, normalized fairly** — each application's own scoring is respected, but the shell normalizes across providers so no single aggressively-self-scoring provider can dominate results purely by inflating its own confidence. This is the same fairness principle already ratified in ARCH-2026-03 §5 for provider ranking.
4. **Category diversity** — an ambiguous query must not let one category (twenty CRM records) crowd out every other category; a diversified blend across categories keeps search usable as a directory, not only a content engine.
5. **Permission-filtered as a precondition, never a post-filter** — a result the user cannot access must never appear even momentarily, and its absence must never be inferable. Entitlement is checked before ranking, not stripped out after.

---

## 6. Breadcrumb Philosophy

Four candidate meanings were proposed. Only one survives scrutiny as the default: **information hierarchy** — where a thing logically lives — not navigation-menu path, not user journey, and not raw application structure.

- **User journey** (the literal sequence of screens visited) must be rejected as the primary meaning: it's unstable and personal. Two users arriving at the same record via different paths would see different breadcrumbs, which destroys breadcrumbs' value as a shared, communicable reference — "go to CRM › Contacts › Jane Doe" only works as an instruction if it means the same thing for everyone, regardless of how they personally got there.
- **Navigation-menu hierarchy** is close, but conflates "how deep is the menu" with "what does this thing belong to." A Contact reached through global search should still read "CRM › Contacts › Jane Doe," never "Search Results › Jane Doe" — the breadcrumb describes where the record lives, not the path just taken to reach it.
- **Application structure** is not wrong so much as a common special case: when a record's natural containment matches its owning application's own module structure — the usual case — the breadcrumb will look identical to application structure. The two diverge whenever information logically spans beyond one application's internal boundaries (for instance, a workspace-level prefix ahead of the application segment).

> **Rule.** A breadcrumb answers "where does this live," never "how did I get here." The mechanism for declaring it — the active application registering its current trail — was already established in ARCH-2026-03 §4; this is the philosophy that content must follow.

---

## 7. URL Philosophy

A URL is an address, not a client-side implementation detail, and it deserves the same durability discipline as a public API — arguably more, because its consumers (bookmarks, sent emails, printed documents, third-party integrations) can never be enumerated or forced to upgrade the way internal application code can.

**What a URL should expose, conceptually** (illustrative structure, not literal syntax):

```
{ tenant } / { workspace } / { application } / { application-owned path… } / { entity-id } / { action, if durable }
```

- **Tenant** — encoded early and stably (commonly via subdomain), because Tenant is a fixed-at-boot context (ARCH-2026-03 §1); making it explicit in the address means a URL can never be pasted or shared in a way that silently resolves against the wrong tenant.
- **Workspace** — encoded, because a shared link should restore the workspace it was created in. Must degrade gracefully — not with a hard error — if that workspace has since changed or been removed.
- **Application** — encoded as a stable, permanent slug, never an internal identifier. Because Application is the platform's stable governance unit (§1, §2), its slug is effectively a permanent public contract the moment it ships; renaming it breaks every bookmark, shared link, and notification ever issued.
- **Module / Feature / Page** — optional, and entirely the owning application's decision. The shell doesn't need to understand or govern this part of the address, consistent with §2's boundary.
- **Entity IDs** — required wherever a URL points at a specific record, and must be stable, permanent identifiers that are never reused and never dependent on position or ordering. A link to a specific record must resolve correctly years later.
- **Actions** — exposed only when the action is a legitimate, resumable destination (open this record in edit mode, review this approval) — never for transient UI state (which tab is open, which panel is expanded). Over-encoding ephemeral state into the address makes the address fragile and noisy; the discipline is to encode durable, meaningful state only.

**Stability.** A shipped URL structure is permanent. This is deliberately a *stricter* standard than the contract-versioning window ratified in ARCH-2026-03 §6, and the reason is specific: an internal contract has a fully enumerable set of consumers (registered applications) that can be identified and required to upgrade within a bounded window. A URL's consumers cannot be enumerated and can never be forced to upgrade — a five-year-old email sitting in someone's inbox is still a live consumer. The only safe policy is that old URL structures redirect indefinitely; there is no deprecation window for an address, only permanent forwarding.

---

## 8. Deep Linking

Bookmarks, shared URLs, notifications, emails, command-palette results, and global-search results are not six separate features — they are six entry points into **one unified deep-linking contract**: resolving a stable URL back to a specific, permission-checked, contextually-correct piece of application state.

Every entry point must satisfy the same four requirements:

1. **Re-establish full context before resolving anything.** Tenant, workspace, and identity must be confirmed — never assumed — before the shell attempts to resolve the target, regardless of whether the user arrived via a two-year-old email or a search result generated a second ago.
2. **Re-check entitlement at resolution time, not at link-creation time.** Permissions are a live context (ARCH-2026-03 §1); a link that was valid when created may not be valid when opened, and the check must happen fresh, every time.
3. **Degrade gracefully when the target is gone or inaccessible.** A clear, actionable message — "this record was deleted," "you no longer have access" — never a raw error, and never a silent blank screen.
4. **Internally-generated links resolve through the identical mechanism as externally-shared ones.** Command-palette and global-search results are, structurally, just deep links the shell generated itself; routing them through the same resolution path as a pasted URL means there is exactly one path to trust and test, not a slightly different one per entry point.

Notifications and emails specifically must always carry the durable, entity-ID-based form of a link (§7) — never a transient, session-scoped one — since they are frequently opened much later, and often from a different device or session entirely.

---

## 9. Cross-Application Navigation

Moving from CRM to Survey Builder to Analytics to Inventory without losing orientation rests on mechanisms already ratified elsewhere in this series, composed together:

- **The shell chrome never changes.** Global navigation, the workspace indicator, and identity persist across every application transition (ARCH-2026-02) — that constant is what tells a user "I am still in the same platform" even as the entire content region's application changes underneath it.
- **Workspace and tenant context are carried through the jump, visibly.** Nothing about switching applications silently rescopes which workspace or tenant the user is in (ARCH-2026-03 §1).
- **Breadcrumbs update immediately to the new application's information hierarchy** (§6), giving an instant "where am I now" anchor rather than leaving stale context on screen.
- **The jump itself is a real deep link** (§8), not an ad hoc client-side redirect — the destination application goes through its full, well-defined lifecycle (ARCH-2026-03 §2: Discovery through Mount) rather than being dropped into a half-initialized state.
- **Two distinct affordances answer two distinct questions, and must not be merged.** The information-hierarchy breadcrumb (§6) answers "where does this live." A separate, secondary "journey" affordance — a shell-level back-stack across application boundaries — answers "how did I get here" for users who hop several applications deep. Overloading one breadcrumb to answer both questions is precisely what §6 already rejects; cross-application hopping is the clearest case for why the two need to remain visually and structurally distinct.
- **Cross-application notifications keep threads alive.** If Survey Builder generates something relevant while the user is working in CRM, the shell's notification system (ARCH-2026-03 §4) is what prevents that thread from being lost the moment the user is no longer looking at Survey Builder.

---

## 10. Scalability Test

At 75 applications, 12 engineering teams, 2,000 routes, 500 permissions, and 1,000 menu entries, the IA does not need a new mechanism — it needs the mechanisms already ratified in ARCH-2026-02 and ARCH-2026-03 to actually be used as designed. If a new mechanism seems necessary to survive this scale, an earlier charter was under-specified.

- **Categories (§3)** stay bounded and browsable regardless of application count, because the category *list* is fixed and governed — it is application membership within categories, not category count, that grows.
- **Search (§5) becomes the primary retrieval method, not a fallback.** Past roughly a couple dozen applications, no amount of clever categorization keeps browsing viable as the primary way people find things; categories exist for orientation and discovery of the unfamiliar, search exists for retrieval of the known.
- **Personal surfaces (§4) become each user's actual default landing experience.** No individual regularly touches more than a handful of the 75 applications; their Pinned/Recent/Frequent set, not the full catalog, should be what they land on. The full catalog is a discovery fallback, never the default view.
- **2,000 routes never need to be held in one person's head**, because the shell-relevant hierarchy is capped at three levels (§2). The other ~1,997 routes are application-internal, invisible to platform-wide governance, and each owning team reasons about only its own slice.
- **500 permissions split cleanly by ARCH-2026-03 §1's coarse/fine boundary** — the navigation layer only ever evaluates the roughly-75 coarse, per-application entitlements needed to render navigation; the remaining ~425 fine-grained permissions are purely each application's internal concern.
- **1,000 menu entries are never hand-curated.** They are the emergent, filtered result of 75 applications each registering a bounded number of contributions (ARCH-2026-03 §5) against a governed schema; any individual user, filtered live by entitlement and workspace, only ever sees a small slice of that total.
- **12 teams contributing simultaneously is what the tiered governance model (ARCH-2026-03 §7) exists for** — namespacing, mandatory entitlement declaration, and review scaled to blast radius are the concrete mechanisms that prevent collision, not goodwill or communication alone.

---

## 11. Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| **Flat, ungoverned mega-menu** | Every application dumping all its entries into one undifferentiated top-level list is browsable at five applications and unusable at seventy-five. |
| **Role-specific parallel IA trees** | Hand-built, distinct navigation structures per role must be maintained in sync forever; they drift, and the maintenance cost multiplies by every role that exists. Rejected explicitly in §1 and §3. |
| **Breadcrumbs as journey history** | Makes breadcrumbs unpredictable and impossible to use as a shared reference in conversation. Rejected explicitly in §6. |
| **Unstable URLs with no permanent redirect policy** | Breaks every bookmark, sent email, and external integration the moment someone "cleans up" a route. Rejected explicitly in §7. |
| **Per-application search silos** | Seventy-five separate search boxes instead of one federated surface defeats the entire purpose of hosting applications inside a shell. |
| **Exposing the full seven-level hierarchy as literal click-through menus** | Turns navigation into spelunking. Most of the conceptual hierarchy in §2 should govern addressing and reasoning, not force a seven-click path to anything. |
| **Conflating "where" and "what"** | Mixing navigational destinations with action verbs in the same menu ("Contacts" sitting beside "Export All Data" as siblings) confuses users about what's a place and what's an operation. |
| **Ambiguous, overloaded category or section names** | "Settings," "Admin," and "Reports" meaning different things in different applications, with no disambiguation, causes users to open the wrong one repeatedly — named specifically as a risk in §5. |
| **Presenting AI recommendations with the same confidence as explicit choices** | Erodes trust the first time a prediction is wrong and the user has no way to tell it was ever a guess. Rejected explicitly in §4. |
| **Uniform governance review regardless of blast radius** | Treating a new icon and a new hierarchy level with the same review weight either bottlenecks trivial changes or rubber-stamps foundational ones. Already addressed by the tiered model in ARCH-2026-03 §7, and it applies identically here. |

---

## 12. Golden Rules

*Permanent Information Architecture rules for the next decade.*

1. **Application is the stable skeleton. Workspace is the lens. Role and permission are filters. Task-centric discovery is an accelerant.** None of the latter three may ever be promoted to replace the first.
2. **The shell governs navigation down to Workspace → Application → an optional thin Section.** Everything beneath that — Module, Feature, Page — belongs entirely to the owning application team.
3. **Category names are a small, static, centrally-governed list; category membership is fully dynamic**, computed from entitlement and workspace at render time, never hardcoded per segment.
4. **Never ship two redundant explicit-intent mechanisms.** One curated "pinned" surface, complemented by implicit recent and frequent signals, is enough.
5. **Inferred or AI-derived surfacing is always visually distinct, explainable, and dismissible** — never presented with the same confidence as a user's own explicit choice.
6. **Search is the primary retrieval method past a few dozen applications, not a fallback for when browsing fails.**
7. **Breadcrumbs represent information hierarchy — where a thing lives — never the user's personal journey to reach it.**
8. **A shipped URL is a permanent public address.** It redirects forever; it is never merely deprecated on a window the way an internal contract is.
9. **Deep linking is one contract with many entry points**, always re-validated at resolution time for context, entitlement, and existence — regardless of whether it arrived as a bookmark, an email, a notification, or a search result.
10. **"Where am I" and "how did I get here" are two different questions and must never share one affordance** — the information-hierarchy breadcrumb answers the first; a separate cross-application journey trail, if provided, answers the second.
11. **If scale ever seems to demand a new IA mechanism, look first at whether an already-ratified mechanism (registration, entitlement-aware filtering, governance tiering) is simply not being used as designed.**

---
*Platform Architecture Review Board · ARCH-2026-04 · Information architecture review only — layout, breakpoints, and Angular implementation addressed separately.*
