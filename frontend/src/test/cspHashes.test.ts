import indexHtml from '../../index.html?raw';
import securityConfig from '../../../backend/src/main/java/com/porra/mundial/config/SecurityConfig.java?raw';

/**
 * La CSP del backend no admite 'unsafe-inline': cada script inline y cada manejador on*
 * de index.html tiene que estar permitido por su hash en SecurityConfig. Si se edita
 * index.html sin actualizar el hash, el navegador lo bloquearía en producción.
 */
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

describe('CSP de index.html', () => {
  it('permite por hash cada script inline y cada manejador on*', async () => {
    const inlineScripts = [
      ...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
    ].map((match) => match[1]);
    const handlers = [...indexHtml.matchAll(/\son[a-z]+="([^"]*)"/g)].map((match) => match[1]);

    expect(inlineScripts.length + handlers.length).toBeGreaterThan(0);
    for (const code of [...inlineScripts, ...handlers]) {
      expect(securityConfig).toContain(`'sha256-${await sha256(code)}'`);
    }
  });

  it('no vuelve a permitir scripts inline sin hash', () => {
    expect(securityConfig).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});
