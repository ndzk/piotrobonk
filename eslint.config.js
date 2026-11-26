import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // scripts/redteam and scripts/audit: the Red Team's and the Auditor's own research tools, kept as evidence for
  // BALANCE.md, never part of the game or its gates; scripts/measure: plain-JS helpers of the final measurement.
  { ignores: ['dist', 'dist-offline', 'test-results', 'playwright-report', 'ref', '.sim', 'scripts/redteam', 'scripts/audit', 'scripts/measure'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ['eslint.config.js'] }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  // Game code runs in the browser only: no Node globals there.
  { files: ['src/**'], ignores: ['src/**/*.test.ts'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/**', 'tests/**', 'e2e/**', 'src/**/*.test.ts', '*.config.*'], languageOptions: { globals: globals.node } },
);
