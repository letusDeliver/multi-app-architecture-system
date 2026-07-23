import tseslint from 'typescript-eslint';

/**
 * ADR-001 constraint 3: while the shell and hello-world-app are staged in
 * one workspace (pending repository separation), the boundary between them
 * is enforced here, in CI, from commit one — not left as a convention. This
 * is also the direct, mechanical enforcement of ARCH-2026-02 §4: the shell
 * never imports application source, and applications never import each
 * other's source. Crossing the boundary is only ever permitted through a
 * published contracts package (e.g. @platform/manifest-schema).
 */
export default tseslint.config(
  {
    files: ['projects/shell/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/hello-world-app/**'],
              message:
                'The shell must never import application source (ARCH-2026-02 §4). Cross this boundary only through a published contracts package.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['projects/hello-world-app/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/projects/shell/**', '**/shell/src/**'],
              message:
                'Applications must never import shell source (ARCH-2026-02 §4). Cross this boundary only through a published contracts package.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'packages/**', '.angular/**'],
  },
);
