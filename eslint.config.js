const { FlatCompat } = require('@eslint/eslintrc')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const tsConfigs = compat
  .extends('plugin:@typescript-eslint/recommended')
  .map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  }))

module.exports = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.vercel/**',
      'next-env.d.ts',
      '**/*.md',
      '**/*.mdx',
      '**/*.css',
    ],
    rules: {
      // Start with gentler suggestions for initial adoption
      'prefer-const': 'warn',
    },
  },
  ...compat.extends('next/core-web-vitals', 'prettier'),
  ...tsConfigs,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
]
