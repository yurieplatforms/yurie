import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

/**
 * ESLint flat config for Next.js 16.
 *
 * Note: `eslint-config-next/*` now exports flat config arrays, so we compose them
 * directly (no FlatCompat).
 */
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'dist/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettierRecommended,
  {
    rules: {
      // Disable Prettier as an ESLint error source; formatting is handled separately.
      'prettier/prettier': 'off',
      // Warn on unused variables to avoid blocking builds on stylistic issues.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Error on explicit any to encourage proper typing in new code.
      // Existing any usages have been addressed or are justified with comments.
      '@typescript-eslint/no-explicit-any': 'error',
      // This codebase intentionally uses <img> for highly dynamic/remote sources
      // (e.g. user-provided URLs, blob/object URLs, favicons, etc).
      '@next/next/no-img-element': 'off',
      // App Router projects may legitimately include custom font links in layouts.
      '@next/next/no-page-custom-font': 'off',
      // React 19 hooks lint rules can be too strict for common Next patterns
      // (e.g. mounted flags for hydration). Keep as warnings so they don't block.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
]
