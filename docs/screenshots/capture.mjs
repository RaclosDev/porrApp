// Capturas móviles del README a partir de la demo pública (solo lectura, sin cuenta).
// Uso, desde la raíz: npm --prefix frontend ci && npx --prefix frontend playwright install chromium
//                     node docs/screenshots/capture.mjs [url-base]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const base = process.argv[2] ?? 'https://porra.raclos.es';
const out = fileURLToPath(new URL('./', import.meta.url));

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  const settle = async () => {
    await page.waitForLoadState('load');
    await page
      .waitForFunction(
        () => ![...document.querySelectorAll('[class*="skeleton"]')].some((el) => el.getClientRects().length),
        null,
        { timeout: 15000 },
      )
      .catch(() => console.warn('  (sigue habiendo un esqueleto visible)'));
    await page.evaluate(async () => {
      await document.fonts.ready;
      // Solo las imágenes visibles: las diferidas fuera de pantalla nunca llegan a cargar.
      const visible = [...document.images].filter((img) => {
        const r = img.getBoundingClientRect();
        return !img.complete && r.bottom > 0 && r.top < innerHeight;
      });
      const loaded = Promise.all(
        visible.map((img) => new Promise((r) => {
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
        })),
      );
      await Promise.race([loaded, new Promise((r) => setTimeout(r, 5000))]);
      // El aviso del modo demo no forma parte de la app real.
      document.querySelectorAll('div.sticky').forEach((el) => {
        if (el.textContent?.includes('Modo demo')) el.style.display = 'none';
      });
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
  };
  const shot = async (name) => {
    await settle();
    await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
    console.log(`✓ ${name}.png`);
  };
  const tab = (name) => page.locator('nav').getByRole('link', { name, exact: true }).last().click();

  await page.goto(base + '/');
  await shot('landing');

  await page.goto(base + '/demo');
  await page.getByText(/últimos resultados/i).first().waitFor();
  await shot('home');

  await tab('Ranking');
  await shot('ranking');

  await tab('Mi Porra');
  await shot('prediction');

  await tab('Resultados');
  await shot('bracket');

  await tab('Grupos');
  await shot('groups');
} finally {
  await browser.close();
}
