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

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
