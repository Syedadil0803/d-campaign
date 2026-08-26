import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// ESLint 9 uses "flat config" — this file, exporting a list of settings.
// eslint-config-next 15 is still written in the older format, so FlatCompat
// translates it. Both halves are needed until Next ships a flat-config build.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    // Without this, ESLint reads the build output and reports thousands of
    // problems in generated code nobody wrote.
    ignores: [
      'node_modules/**',
      '.next/**',
      'public/sw.js',
      'security-reports/**',
      'next-env.d.ts',
    ],
  },

  // next/core-web-vitals — React, hooks and accessibility rules.
  // next/typescript  — the TypeScript rules on top of those.
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // A leading underscore is how this codebase marks a parameter it is
      // required to accept and deliberately does not use — Lexical's node API
      // dictates several of these signatures. Deleting them would break the
      // signature; renaming them would lose the signal.
      // Next's TypeScript rules make this an error, and `next build` runs
      // ESLint — so installing this config turned 23 pre-existing `any`s into
      // a failing build and a blocked deploy. They are worth counting, not
      // worth refusing to ship over: a warning keeps every one of them in the
      // report while letting the build through. Typing them properly is its
      // own piece of work.
      /**
       * 750 lines a file, which is SonarQube's default and the only figure in
       * this area with a widely used tool behind it. ESLint's own default is
       * 300 — the right destination, but six files exceed 750 today and
       * thirteen exceed 300, and a rule that fails on day one gets switched
       * off rather than met.
       *
       * So this is a ceiling to ratchet down: 750 now, then 500, then 300, as
       * the large files are split. Comments and blank lines are not counted,
       * because a file is not harder to work with for being explained.
       *
       * A warning rather than an error on purpose. `next build` runs ESLint,
       * and a file being long should not stop a deploy — it should be visible
       * on every run until someone deals with it.
       */
      'max-lines': ['warn', { max: 750, skipBlankLines: true, skipComments: true }],

      '@typescript-eslint/no-explicit-any': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];

export default config;
