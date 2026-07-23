export const environment = {
  /**
   * Where the shell fetches the platform application manifest from at
   * Discovery (ARCH-2026-03 §2). Swapped via a build-time file replacement
   * for the `empty-shell` configuration (ARCH-2026-02 §5's permanent
   * empty-shell CI gate) — never a runtime branch in application code.
   */
  manifestUrl: '/manifest.json',
};
