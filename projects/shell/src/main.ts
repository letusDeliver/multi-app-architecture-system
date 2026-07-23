import { initFederation } from '@angular-architects/native-federation';

// No remotes are declared here. Per ARCH-2026-02 §4/§5, the shell must never
// have a build- or boot-time dependency on any specific application — every
// application is discovered at runtime from the platform manifest
// (see PlatformManifestService) and loaded on demand via loadRemoteModule.
initFederation()
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
