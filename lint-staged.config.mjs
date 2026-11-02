export default {
  'frontend/**/*.{ts,tsx}': ['prettier --write', 'node scripts/lint-staged-frontend.mjs'],
  'frontend/**/*.{json,css,md}': ['prettier --write'],
};
