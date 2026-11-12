import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'dist-offline', 'test-results', 'playwright-report'] },
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
