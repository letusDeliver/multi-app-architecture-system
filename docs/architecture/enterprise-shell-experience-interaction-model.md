# The Enterprise Shell — Experience & Interaction Model

**Doc ID:** ARCH-2026-05 · Companion to ARCH-2026-02 (Shell Charter), ARCH-2026-03 (Runtime Contract), ARCH-2026-04 (Information Architecture)
**Issued by:** Platform Architecture Review Board
**Status:** Ratified
**Scope:** How the shell *behaves* toward the user — layout philosophy, permanent regions, interaction states, cross-application continuity, responsive and keyboard behavior, and perceived performance. No layout implementation, no components, no HTML, no CSS, no Angular, no UI libraries.

> **Reading note.** ARCH-2026-02 defined what the shell owns. ARCH-2026-03 defined how an application lives inside it at runtime. ARCH-2026-04 defined how information is organized and addressed. None of those three answer what the user actually *experiences* moment to moment — what happens when they switch applications, what a loading state feels like, whether the platform feels like one product or seventy-five bolted together. This document is that behavioral contract. Every principle here must survive being implemented in any technology, on any device, a decade from now. If a recommendation only makes sense for a particular component library or a particular framework's animation system, it does not belong in this document — it belongs in an implementation guide written against this one.

---

## 1. Layout Philosophy

Five layout strategies are usually presented as competing choices. They are not competing — they answer different questions, and conflating them is the actual mistake.

- **Fixed** — regions occupy an unchanging size regardless of viewport. Maximizes predictability, wastes space on large displays, breaks outright on small ones.
- **Fluid** — regions stretch and shrink continuously and proportionally to fill whatever viewport exists. Maximizes space usage, but a control that lives at a different pixel position every time the window resizes destroys muscle memory — a serious cost for a surface used eight hours a day, every day, for years.
- **Adaptive** — a small number of discrete, deliberately-designed layout modes, switched at defined thresholds. Nothing reflows continuously; the layout *jumps* between a fixed number of known-good states.
- **Responsive** — continuous proportional reflow (fluid) constrained within upper and lower bounds, so it never fully abandons predictability.
- **Hybrid** — different regions of the same screen are governed by different strategies simultaneously, chosen per-region rather than applied uniformly to the whole page.

### The recommendation

**The shell's chrome is adaptive. The content area is responsive, within bounds set by the shell.**

The regions a user relies on for orientation — primary navigation, the header, the workspace switcher — must occupy the *same relative position and the same discrete states* every time, on every device, for the life of the platform. A user who has built ten years of muscle memory around "navigation collapses to icons-only at this point" must never experience that threshold silently drifting, or the control smoothly resizing through every intermediate state in between. Predictability in the chrome is not a visual preference; it is what lets a power user operate the shell without looking at it.

The content area, by contrast, is where the actual work happens, and work benefits from making full use of available space. It is governed responsively, but never edge-to-edge without bound (§8) — an application team may let its content reflow continuously, but always within a maximum/minimum width envelope the shell defines, so that a Contact record isn't rendered as one comfortable column on a laptop and an unreadable 4,000-pixel-wide strip on an ultrawide monitor.

> **Rule.** Consistency in the chrome is not negotiable per application; flexibility in the content area is expected and encouraged. Conflating the two — letting an individual application redefine how the shell's own chrome behaves — is the layout-level equivalent of the shell/application boundary violation named in ARCH-2026-02 §4.

---

## 2. Shell Regions

Every permanent region answers the same four questions: what is it for, who owns what appears in it, when does it exist, and when is it visible.

| Region | Purpose | Ownership | Lifecycle | Visibility |
|---|---|---|---|---|
| **Header** | Global orientation and platform-wide capability access — identity, search, notifications, workspace | Shell, entirely (ARCH-2026-02 §2) | Exists for the full session, from the moment authentication resolves until logout | Always visible; may compress to a reduced set of controls (§3), never fully hidden |
| **Primary Navigation** | Cross-application movement — the answer to "what else exists on this platform" | Shell owns the mechanism and the top three taxonomy levels (ARCH-2026-04 §2); content is a registration, not shell-authored | Exists once the registry (ARCH-2026-03 §2) resolves; populated per-user by permission evaluation | Always present in some state (expanded, collapsed, or temporarily hidden on small viewports — §4, §8); never removed entirely, because a user must always be able to leave the current application |
| **Content Area** | Where the mounted application actually renders | Shell owns the frame and mount point; the application owns everything inside it (ARCH-2026-02 §2) | Bound to the mounted application's lifecycle (ARCH-2026-03 §2) — populated at Mount, cleared at Unmount | Always visible when an application is active; shows a defined empty/landing state when none is (§6) |
| **Secondary Navigation** | In-application wayfinding — tabs, sub-sections, a module switcher internal to the current app | Entirely application-owned (ARCH-2026-04 §2) | Bound to the hosting application's own internal state, not the shell's | Present only when the active application declares it; absent by default, never a permanent shell region |
| **Status Area** | Low-emphasis, ambient system state — sync status, connectivity, environment | Shell owns the surface; applications register content into it (ARCH-2026-03 §5, "status bar") | Persistent for the session | Always present but deliberately low-visual-weight; must never compete with primary content for attention |
| **Notification Area** | The single inbox for events raised by any application (ARCH-2026-03 §4) | Shell, entirely | Persistent for the session | The entry point (a badge/bell) is always visible; the expanded panel is transient, opened on demand |
| **Workspace Area** | Indicates and controls the current workspace scope (ARCH-2026-03 §1) | Shell, entirely | Persistent for the session, re-renders live on workspace change | Always visible — a user must never be uncertain which workspace they're currently scoped to |
| **Footer** | Legal, versioning, and support-adjacent links | Shell, entirely, where present at all | Persistent, if present | The one region this charter recommends treating as **optional by default**: a dense, working-all-day enterprise shell spends its screen budget on the content area, not on a permanently visible footer. Where required (legal notices, build metadata for support), it belongs in a low-emphasis, deliberately out-of-the-way surface — not fixed real estate competing with the content area on every screen |

> **Rule.** A region's existence is permanent even when its *visible content* is empty (an application with no secondary navigation still leaves that region absent, not rendered-blank) — the distinction in §6's Empty State principle. No region may be added to this table, and no application may introduce a new persistent chrome region of its own, without Tier 2 review (ARCH-2026-03 §7): a new permanent region is a taxonomy-level change, not a contribution-level one.

---

## 3. Header Experience

The header carries more concurrent responsibility than any other region, which makes discipline about what it does and does not own especially important.

| Responsibility | Behavior |
|---|---|
| **Global Search** | Always reachable from the header in one interaction, never buried in a menu — search is the primary retrieval method at scale (ARCH-2026-04 §5, §10) and the header is its permanent point of entry |
| **Workspace Switcher** | Always visible, always reflects current scope; switching is itself the operation defined in ARCH-2026-03 §1 — a header control, never a client-side illusion of one |
| **Notifications** | A single, badge-carrying entry point into the one notification center (ARCH-2026-03 §4) |
| **Quick Actions** | Context-aware actions surfaced for fast access; the set shown may compress under space pressure, but the entry point to the full set must not disappear |
| **Environment Badge** | A persistent, unmistakable indicator when running outside production (ARCH-2026-03 §1) — small in visual weight, but never optional in a non-production environment; the cost of a support engineer mistaking staging for production is categorically worse than a small amount of header clutter |
| **Help** | Always present, always in the same position — an enterprise user under time pressure should never need to relearn where help lives across applications |
| **Profile / Identity** | The header's representation of the resolved identity context (ARCH-2026-03 §1); also the conventional home for session-related actions (logout, switch account) |
| **Command Palette** | Its own always-available invocation point (a reserved shortcut, §9, plus a header affordance), distinct from Search in intent even though it later surfaces overlapping results (ARCH-2026-04 §5) |

**Should the header remain fixed?** Yes, always visible, never scrolled out of view — it is the one constant a disoriented user (mid-incident, mid-context-switch, on an unfamiliar application) can always return to. **When should it change?** Only in density, never in position or presence: under vertical space pressure (small viewports, §8) it may collapse secondary controls (Quick Actions, Help) behind an overflow affordance, but Identity, Search, Notifications, and Workspace — the four orientation-critical controls — are never the ones sacrificed first.

---

## 4. Navigation Experience

Seven behaviors were named; they map to two independent dimensions rather than seven unrelated states — **how much space the navigation claims** (expanded / collapsed) and **how it's presented** (persistent / temporary / floating), with nesting and context layered on top.

| Behavior | When it applies | Reasoning |
|---|---|---|
| **Expanded** | Default on desktop/laptop where horizontal space is not scarce | Labels alongside icons remove recall burden — a new engineer on their third day shouldn't have to memorize what an icon means |
| **Collapsed** | User-chosen, or the default on narrower desktop viewports | Reclaims space for content once a user has already built icon-level familiarity (§4's own "Recent/Frequent" reasoning from ARCH-2026-04 applies here too — familiarity is earned, not assumed on day one) |
| **Temporary** | Small viewports (§8) — navigation as an overlay invoked on demand rather than permanently occupying the frame | On a small viewport, permanently reserving space for navigation the user isn't currently using is a worse trade-off than one extra tap to summon it |
| **Persistent** | Desktop/laptop, both expanded and collapsed states | The primary navigation should never be a global toggle a user must remember to re-open on larger viewports — it is furniture, not a modal |
| **Nested** | Strictly bounded — this platform's taxonomy caps shell-relevant nesting at Workspace → Application → an optional thin Section (ARCH-2026-04 §2) | Nesting beyond that point is application-internal and does not belong in shell-rendered navigation at all; a primary nav that grows a fourth or fifth visible level has silently absorbed application structure it has no business knowing about |
| **Contextual** | Secondary navigation, entirely application-owned (§2, §5) | Belongs to the content area, not the shell's primary navigation — conflating the two is the "where vs. what" anti-pattern named in ARCH-2026-04 §11 |
| **Floating** | Command palette, quick-action menus, transient contextual menus | Reserved for interactions that are inherently transient and dismissible by nature — floating navigation as a *permanent* wayfinding mechanism is a contradiction; if it's how users are expected to reliably find something every day, it has failed to be floating and should be promoted to a docked surface |

**Efficient movement.** A user should have at least three converging paths to anything they need regularly: a persistent nav entry for habitual movement, a personal surface (Pinned/Recent/Frequent, ARCH-2026-04 §4) for resumption, and search/command palette for everything else, including the unfamiliar. Navigation efficiency is measured by how rarely a user needs the *slowest* of these three — full category browsing — not by how clever any single mechanism is in isolation.

---

## 5. Content Area Philosophy

The content area is the one region where the shell must resist the temptation to do more than its share, while still keeping the platform feeling coherent.

**Who owns what:**

| Element | Owner | Reasoning |
|---|---|---|
| Page Title | Shared — application supplies a title segment, shell composes the final displayed title (ARCH-2026-03 §4) | Keeps a consistent suite-level format without the shell needing to know what the title *means* |
| Action Bars | Application | The actions available on a given screen are pure business logic |
| Tabs | Application | Internal wayfinding within a single application's own information structure |
| Filters | Application | Filtering criteria are domain vocabulary — exactly what ARCH-2026-02 §3 excludes from the shell |
| Secondary Navigation | Application (§2, §4) | Contextual to the hosting application's own structure |

**The boundary, precisely stated:** the shell owns *positional and behavioral grammar* — where a primary action conventionally sits, how a tab strip conventionally behaves, how a filter panel conventionally opens and closes — as a shared interaction vocabulary every application is expected to honor, exactly the way ARCH-2026-02 §2 distinguishes the shell owning a *mechanism* from an application supplying *content*. The shell does not, and must never, reach into the content area to dictate what those elements actually say or do. An application team that invents its own bespoke interaction pattern for "the primary action on this screen" — rather than reusing the platform's shared grammar for where a primary action goes — reintroduces exactly the "twelve subtly divergent implementations" failure mode ARCH-2026-02 §1 exists to prevent, one screen at a time.

---

## 6. Interaction States

Every one of these states must produce a defined, deliberate user experience — an *undefined* state (a blank screen, a frozen spinner, a silent failure) is itself the failure this section exists to prevent.

| State | What the user should experience |
|---|---|
| **Loading** | A shape-aware placeholder (a skeleton reflecting the content about to appear) wherever the eventual layout is predictable; an indeterminate indicator only when it genuinely isn't. The distinction matters because a skeleton sets accurate expectations about what's coming, while a generic spinner sets none. |
| **Initialization** | Fast, minimal, and honest — a boot sequence should never imply more work is happening than actually is. This is the shell's own startup (ARCH-2026-03 §2 Discovery/Registration), not an application's; it should be the shortest perceived wait in the entire session, since it happens before the user can do anything at all. |
| **Application Switching** | Should feel closer to *changing floors in the same building* than *leaving and re-entering a different building*. The shell chrome persists untouched (§7, ARCH-2026-04 §9) throughout; only the content area transitions. |
| **Permission Denied** | A specific, actionable explanation — what's missing and, where applicable, how to request it — never a generic 403 or a silently vanished nav entry. Coarse entitlement failures are caught before mount (ARCH-2026-03 §2); this state covers the cases a user still reaches one, e.g., via a stale deep link (ARCH-2026-04 §8). |
| **Offline** | Clearly indicated, not silently degraded. The platform should be explicit about what still works (locally cached, read-only views) versus what's blocked, rather than letting a user act on data that may already be stale. |
| **Maintenance** | A scheduled, informative banner is strongly preferred over a hard block wherever partial availability is genuinely possible; where a full block is unavoidable, the message states expected duration, not just that access is denied. |
| **Error** | The outer, fatal boundary (ARCH-2026-02 §2) produces one consistent, calm recovery screen suite-wide; it is categorically different from an application's own recoverable inner error state, which stays scoped to that application's content area and never takes down the whole shell. |
| **Empty State** | Guidance toward the next action, not a blank void — an empty state is a teaching moment (this is where X will appear, here's how to create your first one), never indistinguishable from a broken or loading screen. |
| **Slow Network** | Progress must remain visibly *alive* — an operation that's merely slow must never look identical to one that's frozen. Perceived responsiveness during degraded conditions is addressed further in §10. |
| **Session Expiring** | A visible warning issued before expiry, with enough lead time to act, consistent with Session being a live, centrally-owned state machine (ARCH-2026-03 §1) — never a surprise. |
| **Session Expired** | Re-authentication that preserves and returns the user to exactly where they were, via the same deep-linking mechanism used for any other entry point (ARCH-2026-04 §8) — never a hard reset to a generic landing page as the price of a lapsed token. |
| **Impersonation** | An unmistakable, persistent, impossible-to-miss indicator for the entire duration — this is a trust and audit-sensitive state (ARCH-2026-03 §1 names cross-tenant impersonation as a separately audited operation), and subtlety here is a defect, not a design refinement. |
| **Read-only Mode** | Equally persistent and unmistakable, with mutating controls visibly disabled at the point of interaction rather than silently failing on submit — a user should never discover read-only mode by having an action rejected after the fact. |

---

## 7. Cross-Application Experience

**Users should feel they remain inside one platform, never that they've "changed applications."** This is the experiential payoff of the boundaries ratified in ARCH-2026-02 and ARCH-2026-03 — it is only achievable because the shell chrome never depends on which application is mounted.

- **Continuity.** The header, primary navigation, workspace indicator, and identity context are visually and behaviorally identical before and after a cross-application jump (ARCH-2026-04 §9). Continuity is not an animation effect layered on top — it's the direct consequence of those regions genuinely not re-rendering or resetting.
- **Animation philosophy.** Motion exists to reinforce *spatial and contextual continuity*, never as decoration. A transition should communicate "the content area is being replaced; everything else held still" — a full-screen flash, reload-style transition, or anything that makes the whole viewport appear to reset works directly against that message and should be treated as a defect, not a stylistic choice. Where in doubt, less motion is safer than more: motion that draws attention to itself has already failed at reinforcing continuity.
- **State preservation.** The Inactive/Suspend lifecycle stages (ARCH-2026-03 §2) exist precisely so that returning to a previously-visited application can restore rather than reinitialize — a user who switches away mid-task and back a minute later should generally find their place held, not a cold start.
- **Context preservation.** Workspace, locale, and identity carry through every cross-application jump untouched (ARCH-2026-03 §1); nothing about switching applications may silently change any of them.
- **Workspace continuity.** The current workspace scope is never implicitly altered by an application switch — a workspace change is always its own explicit, visible operation (§2's Workspace Area, ARCH-2026-03 §1), never a side effect of navigating elsewhere.

---

## 8. Responsive Behaviour

The device classes below are treated as points on one continuum governed by the adaptive-chrome/responsive-content split in §1, not as seven independently-designed experiences.

| Device class | Navigation | Header | Interaction |
|---|---|---|---|
| **Desktop** | Persistent, expanded by default | Full control set visible | Mouse + keyboard both fully supported; hover-dependent affordances are acceptable as *accelerants* only, never as the sole path to a capability |
| **Laptop** | Persistent, collapsed more readily than desktop as the default | Full control set, earlier compression under width pressure | Same as desktop |
| **Tablet** | Collapsible, frequently temporary in portrait orientation | Compresses secondary controls behind overflow sooner than laptop | Touch-primary; interactive targets sized for touch reliability, hover-only affordances are not acceptable here |
| **Mobile** | Temporary by default (§4) — navigation is summoned, not permanently resident | Reduced to the orientation-critical set only (Identity, Search, Notifications, Workspace — §3); everything else behind overflow | Touch-primary, one-handed operation assumed as a baseline case, not an edge case |
| **Ultra-wide Displays** | Persistent, expanded — abundant space removes any pressure to collapse | Full control set, with room to spare | Content area is capped at a readable maximum width (§1) rather than stretched edge-to-edge; unused lateral space is a legitimate outcome, not a bug to fix by force-filling it |
| **Foldable Devices** | Treated as a dynamic viewport-class transition, not a bespoke fourth interaction model | Reflows per the nearest applicable class above as the effective viewport changes | The fold/unfold transition itself must not destroy in-progress state — this is the same continuity guarantee §7 already requires across application switches, applied to a viewport change instead |

**Should navigation, header, or interaction change per device?** Yes, all three change in *density and presentation* — but never in *position, meaning, or capability*. A control available on desktop must still be reachable on mobile, even if it now lives behind an overflow affordance rather than sitting inline; hiding a capability entirely on a smaller device, rather than relocating it, is a scalability failure disguised as a design decision.

---

## 9. Keyboard and Power User Experience

An enterprise shell used eight hours a day rewards investment in speed differently than a consumer app used in short bursts — the same interaction repeated thousands of times a year justifies experience decisions a lighter-touch product would not.

- **Keyboard navigation.** Every shell surface — header controls, primary navigation, notification panel, dialogs — must be fully operable without a pointer. This is a baseline requirement, not an enhancement layered on afterward.
- **Command Palette.** The universal power-user entry point, surfacing every registered Quick Action, navigation target, and header action without a second registration (ARCH-2026-03 §5, "register once"). For a power user, the palette should eventually become faster than browsing navigation for nearly everything.
- **Global Shortcuts.** Namespaced and centrally arbitrated by the shell (ARCH-2026-03 §5) — an application may register a shortcut scoped to itself, but the shell reserves a small set of global keys (palette invocation, search invocation) that no application may ever claim, and conflicting registrations are surfaced, never silently resolved.
- **Focus Behavior.** Focus must be deliberately managed across every mount/unmount and dialog open/close transition (ARCH-2026-02 §2) — a user tabbing through the interface should never land on a control that just disappeared, or lose their place entirely during an application switch.
- **Accessibility-first interactions.** Every principle in this document — keyboard operability, persistent and unmistakable state indicators (§6), redundant (non-color-only) signaling — is a default behavior, not a supplementary mode toggled on for a subset of users.
- **Productivity principles.** The recurring theme across this section: a power user's efficiency ceiling should be bounded by how fast they can think, not by how many clicks the shell requires. Every mechanism here exists to shorten the distance between intent and action for the platform's heaviest, most habitual users.

---

## 10. Performance Perception

Perceived speed is a UX discipline independent of actual technical latency, and — exactly like search, theming, or notifications — it must have one consistent implementation platform-wide rather than seventy-five independent guesses (ARCH-2026-02 §1).

- **Skeletons** over indeterminate spinners whenever the eventual content shape is predictable — they set correct expectations about what's arriving and reduce the perceived wait even when actual latency is unchanged.
- **Progress Indicators** for any operation with genuinely quantifiable progress (ARCH-2026-03 §4's Progress capability) — a percentage or step count is always more reassuring than an indeterminate spinner when one is honestly available.
- **Lazy Rendering** — render what's visible or immediately needed first; defer everything else. A user should never wait on work whose result they can't yet see.
- **Progressive Loading** — partial, incrementally-arriving results (visible immediately, refined as more arrives) are almost always preferable to withholding the whole screen until every last piece of data resolves.
- **Optimistic Updates** — where an action's success is highly likely, reflect the result immediately and reconcile quietly afterward; but only ever paired with a visible, honest rollback path for the cases it turns out to be wrong. Optimism without a graceful failure path is not optimism — it is silently lying to the user under normal conditions.
- **Transition Feedback** — every user-initiated action produces some immediate acknowledgment, even before the real result is ready. The single worst perceived-performance failure is an interaction that gives no feedback at all, leaving a user unsure whether their action registered.

---

## 11. Enterprise UX Anti-patterns

| Anti-pattern | Why it compounds over years |
|---|---|
| **Full-screen reload feel on every navigation** | Undermines the entire "one platform" premise this document and ARCH-2026-04 §9 are built on; a suite that flashes and resets on every click reads as a loose bag of tools no matter how consistent its visual design is. |
| **Per-application bespoke dialogs, toasts, or progress UI** | Already forbidden at the contract level (ARCH-2026-03 §4); experientially, it's the fastest way for users to learn that the platform's "consistency" is only skin-deep. |
| **Destructive and safe actions given equal visual weight** | An enterprise user moving fast across dozens of applications relies on consistent visual weighting to avoid catastrophic mistakes; treating "Delete Tenant" the same as "Save Draft" is a standing incident waiting to happen. |
| **Silent session expiry with in-progress work lost** | Directly violates the Session Expiring/Expired states in §6; the cost compounds because it teaches users to distrust the platform with any unsaved work, changing their behavior platform-wide, not just in the application where it happened once. |
| **Indefinite, context-free loading with no escape** | A spinner with no timeout, no cancel path, and no indication anything is still actually happening trains users to distrust the loading state itself, which then poisons trust in every future legitimate wait. |
| **Mobile treated as an afterthought retrofit** | Bolting a mobile experience onto a desktop-first design after the fact reliably produces exactly the hidden-capability failure named in §8 — features quietly missing rather than deliberately relocated. |
| **Undifferentiated notification priority** | Every notification arriving with identical visual weight teaches users to ignore the channel altogether within weeks — the same "twelve inconsistent channels" failure ARCH-2026-02 §1 names, recreated inside a single unified inbox instead of prevented by it. |
| **Breadcrumbs or navigation conflating "where" with "how did I get here"** | Already rejected at the information-architecture level (ARCH-2026-04 §6, §9); resurfacing it as a UX pattern (e.g., an animated "journey trail" standing in for the actual location hierarchy) reintroduces the identical instability by a different name. |
| **Meaning carried by color or motion alone** | A status conveyed only by a color shift or only by an animation excludes users who can't perceive that channel, and is also simply less legible at a glance for everyone — state should always have a redundant, non-color signal (a label, an icon, a position). |
| **Sensitive states (impersonation, read-only) rendered subtly** | The opposite of what §6 requires; subtlety here is not restraint, it's a trust and audit failure, since the entire point of these indicators is that they must be impossible to miss or forget about mid-session. |

---

## 12. Golden Rules

*Permanent Experience & Interaction principles for the next decade, valid regardless of what frontend technology implements them.*

1. **The chrome is adaptive and consistent; the content area is responsive within bounds the shell sets.** Predictability is non-negotiable in the regions users rely on for orientation; flexibility is expected and encouraged in the region where the actual work happens.
2. **Every permanent region has one owner, one lifecycle, and one defined visibility rule.** A region existing but rendering empty is a designed state (§6), never an accident.
3. **The four orientation-critical header controls — Identity, Search, Notifications, Workspace — are the last things sacrificed under any space or density pressure**, on any device.
4. **Switching applications must feel like moving within one building, never like leaving and re-entering a different one.** Chrome persists untouched; only the content area transitions, and motion exists only to reinforce that continuity.
5. **Every interaction state named in §6 must produce a deliberate, designed experience.** An undefined state — a blank screen, a frozen spinner, a silent failure — is itself the defect.
6. **Sensitive states are loud, never subtle.** Impersonation and read-only mode are unmistakable and persistent for their entire duration, by design, not by restraint.
7. **A capability available on desktop is reachable on every device.** It may be relocated behind denser presentation on a smaller viewport; it is never simply removed.
8. **Every shell surface is fully keyboard-operable, and accessibility is a default behavior, not a supplementary mode.**
9. **Perceived performance is engineered deliberately — skeletons, honest progress, and immediate feedback on every action — with exactly one consistent implementation platform-wide**, the same "true singleton" discipline ARCH-2026-02 already applies to every other shell capability.
10. **If a proposed interaction pattern would require users to relearn how the platform behaves between applications, reject it** — regardless of how well it serves any single application in isolation.

---
*Platform Architecture Review Board · ARCH-2026-05 · Experience and interaction review only — visual design, componentry, and Angular implementation addressed separately.*
