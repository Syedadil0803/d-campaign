import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// ESLint 9 uses "flat config" — this file, exporting a list of settings.
// eslint-config-next 15 is still written in the older format, so FlatCompat
// translates it. Both halves are needed until Next ships a flat-config build.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
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
];
