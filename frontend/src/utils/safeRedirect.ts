/**
 * Ruta interna a la que volver tras entrar, o `undefined` si el valor no es una ruta de la propia
 * aplicación (evita redirecciones abiertas: `//otro.sitio`, `https://…`, `/\otro.sitio`).
 */
export function safeRedirect(raw: string | null | undefined): string | undefined {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes(String.fromCharCode(92)))
    return undefined;
  // Sin caracteres de control ni espacios iniciales que algunos navegadores ignoran al navegar.
  if ([...raw].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    return undefined;
  }
  const path = raw.split(/[?#]/)[0];
  if (path === '/login') return undefined;
  return raw;
}
