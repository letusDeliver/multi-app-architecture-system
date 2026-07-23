# Architecture

An Angular-based enterprise shell for a multi-application (micro-frontend) platform. The shell hosts independently built and deployed applications behind a single, consistent experience — handling composition, routing, auth, and cross-cutting concerns so individual app teams can ship on their own schedule.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.19.

## Architecture decisions

Platform-level design decisions are documented under [`docs/architecture/`](docs/architecture/):

| Doc | ID | Covers |
| --- | --- | --- |
| [Enterprise Shell — Architectural Charter](docs/architecture/enterprise-shell-charter.md) | ARCH-2026-02 | Purpose, scope, and boundaries of the shell |
| [Enterprise Shell — Runtime Contract](docs/architecture/enterprise-shell-runtime-contract.md) | ARCH-2026-03 | Interface between the shell and hosted applications |
| [Enterprise Platform — Information Architecture](docs/architecture/enterprise-shell-information-architecture.md) | ARCH-2026-04 | Navigation, layout, and content organization |
| [Enterprise Shell — Experience & Interaction Model](docs/architecture/enterprise-shell-experience-interaction-model.md) | ARCH-2026-05 | UX patterns and interaction conventions across hosted apps |
| [Enterprise Platform — Implementation Architecture Decision Log](docs/architecture/enterprise-platform-implementation-decisions.md) | ARCH-2026-06 | Living log of ratified engineering decisions (federation, repo strategy, CI/CD, testing, auth, observability, etc.) |

The decision log (ARCH-2026-06) is the most actively updated doc — it grows one ratified decision at a time as the platform's implementation approach is worked out.

Implementation-time decisions that aren't full ARCH documents are recorded as ADRs under [`docs/adr/`](docs/adr/). Each milestone closes with an Architecture Validation Report under [`docs/validation-reports/`](docs/validation-reports/).

## Implementation status: Milestone 3 (Shell Public API v0 — Dialogs)

The workspace currently contains two isolated Angular projects, staged in one repository per [ADR-001](docs/adr/ADR-001-milestone-1-workspace-staging.md) pending eventual repository separation (ARCH-2026-06 Decision 002):

- **`projects/shell`** — the platform shell. Fetches a platform manifest at boot (`public/manifest.json`), validates and registers each entry (`@platform/manifest-schema`), renders navigation from the registry, and mounts registered applications on demand via [Native Federation](https://www.npmjs.com/package/@angular-architects/native-federation). Also implements the Shell Public API v0 (`ShellApiService`): a shell-owned toast host applications trigger via a Service API call, a shell-owned `theme$` live context applications consume read-only, and a shell-owned dialog host applications request via `openDialog()` and await for a typed result.
- **`projects/hello-world-app`** — a trivial reference application, exposed as a Native Federation remote, used to prove the shell/application composition mechanism and now the Shell Public API end to end (it calls `showToast()`, renders the shell's current theme reactively, and calls `openDialog()` to request a confirmation and display whatever result the user resolved it with).
- **`packages/manifest-schema`** — the `@platform/manifest-schema` contracts package, defining the manifest entry shape and Registration-stage validation (structural + contract-version compatibility).
- **`packages/shell-api-contracts`** — the `@platform/shell-api-contracts` contracts package, exposing exactly what an application needs to consume the Shell Public API: `ToastRequest`, `Theme`, `DialogRequest`/`DialogAction`, the `ShellPublicApi` interface, and the `SHELL_API` injection token. Applications depend on this package only — never on the shell's concrete `ShellApiService`.

See [`docs/runbooks/add-remove-application.md`](docs/runbooks/add-remove-application.md) for how registering or removing an application is a manifest-only change, and how contained failure (unreachable/incompatible/non-conforming remotes) is verified. See [`docs/validation-reports/milestone-2.md`](docs/validation-reports/milestone-2.md) and [`docs/validation-reports/milestone-3.md`](docs/validation-reports/milestone-3.md) for the full reports — Milestone 2 proved the fire-and-forget (Toast) and read-only-observable (Theme) communication shapes; Milestone 3 proved the third, request/response (Dialogs), so all three base shapes from ARCH-2026-03 §3/§4 are now validated. Extension Points (§5) — the remaining structurally distinct mechanism — is the explicit candidate for the next milestone.

### Running it locally

```bash
bun install

# Serve the reference application (remote) and the shell (host) — see note below.
bun run start:hello-world-app   # http://localhost:4201
bun run start:shell             # http://localhost:4200
```

> Note: on this maintainer's local setup, Angular's Vite-based dev server (`ng serve`) currently fails under the Bun runtime (a Bun/Vite compatibility issue unrelated to this project's code). Milestone 1 was verified instead by building both projects (`bun run build`) and serving the static `dist/` output — see the runbook for details. If your environment runs `ng serve` under Node.js, the dev-server workflow above should work normally.

### Building and testing

```bash
bun run build          # builds both projects
bun run test           # unit tests for both projects
bun run test:empty-shell  # ARCH-2026-02 §5's permanent empty-shell gate
bun run lint            # ARCH-2026-02 §4 boundary enforcement (ADR-001)
```

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name --project shell
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
