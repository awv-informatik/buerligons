import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import noOnlyTests from 'eslint-plugin-no-only-tests'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/build/**',
    '**/dist/**',
    '**/public/**',
    '**/.yarn/**',
    '**/.build/**',
    '**/*.d.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks, 'no-only-tests': noOnlyTests },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2024 },
      parserOptions: { ecmaFeatures: { jsx: true }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-only-tests/no-only-tests': 'error',
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      'no-async-promise-executor': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-case-declarations': 'off',
      // new in ESLint 9: a value set and never read (worth a look, no error)
      'no-useless-assignment': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { vars: 'all', args: 'none', ignoreRestSiblings: true, caughtErrors: 'none', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    },
  },
  {
    files: ['**/*.config.{js,cjs,mjs,ts,mts}', 'scripts/**', '**/vite-plugins/**', '**/tools/**', 'rollup.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/tests/**', '**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: { 'no-console': 'off' },
  },
  prettier,
)
