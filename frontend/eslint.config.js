import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // This ESLint setup uses Espree, not a TypeScript parser. Keep TypeScript/TSX
    // out of this config; TypeScript correctness is validated by the build/tests.
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Reglas pensadas para React Compiler, que este proyecto no usa.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
);
