// El lint del frontend (typecheck + eslint .) es de todo el proyecto: se lanza una vez, sin la lista de ficheros.
export default {
  'frontend/**/*.{ts,tsx}': [() => 'npm --prefix frontend run lint', 'prettier --write'],
  'frontend/**/*.{json,css,md}': ['prettier --write'],
};
