# Runbook: Adding or Removing an Application

Proves ARCH-2026-02 §5 (deletion test) and §6 (addition test): adding or
removing a registered application is a manifest-only change. Zero lines of
shell source are touched in either direction.

This runbook uses `hello-world-app`, the Milestone 1 reference application,
against the manifest at `projects/shell/public/manifest.json`.

## Current state (one application registered)

```json
{
  "applications": [
    {
      "id": "hello-world-app",
      "remoteEntryUrl": "http://localhost:4201/remoteEntry.json",
      "mountPath": "hello-world",
      "navLabel": "Hello World",
      "requiredEntitlement": null,
      "contractVersion": "0.1.0"
    }
  ]
}
```

## Removing the application (deletion test)

1. Edit `projects/shell/public/manifest.json` and remove the `hello-world-app`
   entry, leaving `{ "applications": [] }`.
2. Rebuild and re-run the shell's tests: `bun run build:shell && bun run test:shell`.
3. Observe: the shell builds and boots identically to the empty-shell CI
   configuration. The nav shows "No applications registered." No file under
   `projects/shell/src/` changed.

```diff
- git diff --stat
  projects/shell/public/manifest.json | 7 +------
  1 file changed, 1 insertion(+), 6 deletions(-)
```

Zero files under `projects/shell/src/**` appear in that diff. That is the
deletion test.

## Adding it back (addition test)

1. Restore the `hello-world-app` entry in `projects/shell/public/manifest.json`.
2. Rebuild: `bun run build:shell`.
3. Observe: the nav shows "Hello World" again; navigating to `/hello-world`
   re-mounts the remote. Again, zero files under `projects/shell/src/**`
   changed — only the manifest.

```diff
  projects/shell/public/manifest.json | 7 ++++++-
  1 file changed, 6 insertions(+), 1 deletion(-)
```

## What "zero shell source lines" actually means here

The shell's code (`platform-manifest.service.ts`, `remote-mount.component.ts`,
`app.routes.ts`) reads the manifest and reacts to however many entries it
contains — none of it is written in terms of `hello-world-app` specifically.
There is no `if (app.id === 'hello-world-app')` anywhere in shell source
(ARCH-2026-02 §6's explicit rule against conditional branches keyed on
application identity). Adding a second, third, or tenth application is the
same one-file diff, repeated.

## Registering a genuinely new application

To register a new application (not just re-adding the reference one):

1. The new application must expose a `Component`-named export from its
   federation config's `'./Component'` exposed module (see
   `projects/hello-world-app/federation.config.js` and `src/app/app.ts` for
   the reference shape) — this is the Milestone 1 mount contract.
2. Add one entry to `projects/shell/public/manifest.json` with a unique `id`,
   its `remoteEntryUrl`, a unique `mountPath`, a `navLabel`, and
   `contractVersion: "0.1.0"` (the only version the shell currently supports —
   see `@platform/manifest-schema`).
3. No shell source changes. No shell redeploy is conceptually required
   in production (Decision 007's CDN-hosted manifest artifact) — Milestone 1
   serves the manifest as a static asset from the shell's own build output as
   a placeholder for that CDN artifact, so a rebuild is still required for
   now. This gap is tracked in the Milestone 1 Architecture Validation Report,
   not hidden.

## Verifying a failure is contained, not fatal

Swap `projects/shell/public/manifest.json` for the fixture at
`projects/shell/public/manifest.faults.json` (four entries: one healthy, one
pointing at an unreachable origin, one with an incompatible `contractVersion`,
one pointing at a remote that doesn't expose a conforming `Component`) and
rebuild. Expected results, verified live in a browser during Milestone 1:

| mountPath | Result |
|---|---|
| `/hello-world` | Mounts normally |
| `/unreachable` | "This application is currently unavailable." Chrome and nav unaffected. |
| `/incompatible` | Never gets a nav entry at all — rejected at Registration (contract version mismatch). Direct navigation shows "No application is registered at this address." |
| `/non-conforming` | "This application is currently unavailable." Same contained failure surface as unreachable. |

In every failure case, the shell chrome and the healthy application's nav
entry remain fully functional — a failure in one registered application never
propagates to the shell or to any other application.
