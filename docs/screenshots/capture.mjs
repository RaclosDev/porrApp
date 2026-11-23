// Capturas móviles del README a partir del modo demo de la propia aplicación (`/demo`).
// La demo responde en el navegador con tres ligas ficticias, así que no hacen falta backend,
// base de datos ni cuenta.
// Uso, con `npm --prefix frontend run dev -- --host 127.0.0.1` en otra terminal y desde la raíz:
//      node docs/screenshots/capture.mjs [url-base]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5173').origin;
const out = fileURLToPath(new URL('./', import.meta.url));
const FONTS = ['Inter', 'Anton'];

/**
 * Qué se captura en cada liga de la demo: ruta, nombre del archivo y, si hace falta, un paso
 * previo dentro de la pantalla.
 */
const LEAGUES = {
  laliga: [
    ['/', 'league-home'],
    ['/jornadas', 'matchday'],
    ['/ranking', 'league-ranking'],
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
};

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
        // El selector de ligas de la demo no forma parte de la app real.
        const banner = document.getElementById('demo-mode-banner');
        if (banner) banner.style.display = 'none';
        // Solo las imágenes visibles: las diferidas fuera de pantalla nunca llegan a cargar.
        const visible = [...document.images].filter((img) => {
          const r = img.getBoundingClientRect();
          return !img.complete && r.bottom > 0 && r.top < innerHeight;
        });
        const loaded = Promise.all(
          visible.map(
            (img) =>
              new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
              }),
          ),
        );
        await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 5000))]);
      }, FONTS);
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

    await page.goto(`${base}/demo?liga=${league}`);
    await page.locator('#demo-mode-banner').waitFor();
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
      await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
      console.log(`✓ ${name}.png`);
    }

    if (errors.length) throw new Error(`Errores en la demo de ${league}: ${errors.join(' ; ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
