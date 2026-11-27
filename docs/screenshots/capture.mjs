// Capturas móviles del README a partir del modo demo de la propia aplicación (`/demo`).
// La demo responde en el navegador con cuatro ligas ficticias (LaLiga, Mundial, UFC y póker), así que
// no hacen falta backend, base de datos ni cuenta.
// Uso, con `npm --prefix frontend run dev -- --host 127.0.0.1` en otra terminal y desde la raíz:
//      node docs/screenshots/capture.mjs [url-base]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5173').origin;
const out = fileURLToPath(new URL('./', import.meta.url));
const FONTS = ['Inter', 'Anton'];

const openCard = (name) => (page) =>
  page
    .getByRole('button', { name: `Ver el cromo de ${name}`, exact: true })
    .first()
    .click();

/**
 * Qué se captura en cada liga: ruta, nombre del archivo y, si hace falta, un paso previo dentro
 * de la pantalla.
 */
const LEAGUES = {
  laliga: [
    ['/', 'league-home'],
    ['/jornadas', 'matchday'],
    ['/ranking', 'league-ranking'],
    ['/ranking', 'player-card', openCard('Aitana')],
    ['/tabla', 'standings'],
  ],
  mundial: [
    ['/', 'home'],
    ['/ranking', 'ranking'],
    ['/bracket', 'final'],
    ['/bracket', 'bracket', (page) => page.getByRole('tab', { name: 'Cuartos' }).click()],
    [
      '/bracket',
      'groups',
      async (page) => {
        await page.getByRole('tab', { name: 'Grupos' }).click();
        // Los grupos quedan bajo los mejores terceros: se sube el primero hasta la cabecera fija.
        await page
          .getByRole('heading', { name: 'Grupo A', exact: true })
          .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 84));
      },
    ],
  ],
  ufc: [['/jornadas', 'ufc']],
  poker: [
    ['/', 'poker-home'],
    ['/poker/mesa', 'poker-table'],
    ['/poker/historico', 'poker-history'],
    ['/poker/estadisticas', 'poker-stats'],
  ],
};

/** Lo que delataría la demo en la captura: el texto visible no puede nombrarla. */
const DEMO_WORDS = /\bdemo\b|ficticio|ejemplo/i;

const browser = await chromium.launch();
try {
  for (const [league, screens] of Object.entries(LEAGUES)) {
    // Un contexto por liga: la demo guarda la liga elegida en la sesión del navegador.
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2, // PNG de 860 × 1864
      isMobile: true,
      hasTouch: true,
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const settle = async () => {
      await page.waitForLoadState('load');
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll('[class*="skeleton"]')].some(
            (el) => el.getClientRects().length,
          ),
        null,
        { timeout: 15000 },
      );
      await page.evaluate(async (fonts) => {
        await Promise.all(fonts.map((font) => document.fonts.load(`16px "${font}"`)));
        await document.fonts.ready;
      }, FONTS);
      // Fotos, escudos y banderas visibles cargados del todo: ni huecos ni imágenes rotas.
      await page.waitForFunction(
        () =>
          [...document.images].every((img) => {
            const r = img.getBoundingClientRect();
            const visible = r.width > 0 && r.bottom > 0 && r.top < innerHeight;
            return !visible || (img.complete && img.naturalWidth > 0);
          }),
        null,
        { timeout: 20000 },
      );
      for (const font of FONTS) {
        expect(
          await page.evaluate((family) => document.fonts.check(`16px "${family}"`), font),
        ).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.waitForTimeout(800);
    };

    /** Comprobaciones de la captura ya preparada: nada que delate la demo ni fotos de reserva. */
    const check = async (name) => {
      const problems = await page.evaluate((pattern) => {
        const found = [];
        const onScreen = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
        };
        if (new RegExp(pattern, 'i').test(document.body.innerText)) found.push('texto de demo');
        const initials = [...document.querySelectorAll('.user-avatar-ink')].filter(onScreen);
        if (initials.length) found.push(`${initials.length} avatares con iniciales`);
        const toasts = [...document.querySelectorAll('[data-sonner-toast]')].filter(onScreen);
        if (toasts.length) found.push('avisos flotantes');
        return found;
      }, DEMO_WORDS.source);
      if (problems.length) throw new Error(`${name}: ${problems.join(', ')}`);
    };

    // El aviso de la demo y su selector de ligas no forman parte de la app real.
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = '#demo-mode-banner { display: none !important; }';
      document.addEventListener('DOMContentLoaded', () => document.head.append(style));
    });
    await page.goto(`${base}/demo?liga=${league}`);
    await page.locator('#demo-mode-banner').waitFor({ state: 'attached' });
    const rejectCookies = page.getByRole('button', { name: 'Rechazar', exact: true });
    if (await rejectCookies.isVisible()) await rejectCookies.click();

    for (const [route, name, prepare] of screens) {
      // Navegación interna: una recarga completa perdería el estado de la demo en memoria.
      if (new URL(page.url()).pathname !== route) {
        await page.locator(`nav a[href="${route}"]`).last().click();
        await page.waitForURL(`${base}${route}`);
      }
      await settle();
      await page.evaluate(() => window.scrollTo(0, 0));
      if (prepare) {
        await prepare(page);
        await settle();
      }
      await check(name);
      await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
      console.log(`✓ ${name}.png`);
      // Un cromo abierto tapa la pantalla siguiente.
      await page.keyboard.press('Escape');
    }

    if (errors.length) throw new Error(`Errores en la demo de ${league}: ${errors.join(' ; ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
