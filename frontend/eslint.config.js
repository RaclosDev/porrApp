import js from '@eslint/js';
import react from 'eslint-plugin-react';

export default [
  { ignores: ['dist', 'dev-dist'] },
  js.configs.recommended,
  {
    // This ESLint setup uses Espree, not a TypeScript parser. Keep TypeScript/TSX
    // out of this config; TypeScript correctness is validated by the build/tests.
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      react,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': 'warn',
      'no-undef': 'off'
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
