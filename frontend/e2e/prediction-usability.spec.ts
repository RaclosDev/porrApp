import { expect, test, type Page } from '@playwright/test';
import { LEAGUES, mockPredictionApp } from './predictionMocks';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const MOBILE = { width: 375, height: 812 };

/** Lleva la página y cualquier panel con scroll propio hasta el final. */
const scrollToEnd = (page: Page) =>
  page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

for (const width of [1280, 1440]) {
  test(`el cuadro de escritorio enseña el nombre entero y la bandera junto a los puntos a ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mockPredictionApp(page, LEAGUES.world);
    await page.goto('/prediction');

    const tree = page.locator('.bracket-paper-board .bracket-tree-match');
    await expect(tree.getByText('Alemania', { exact: true }).first()).toBeVisible();
    await expect(tree.locator('.team-slot-points').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const slots = await tree.locator('.team-slot').evaluateAll((elements) =>
      elements.map((slot) => {
        const name = slot.querySelector<HTMLElement>('.team-slot-name')!;
        const flag = slot.querySelector('img');
        return {
          name: name.textContent,
          // Ni puntos suspensivos ni una tercera línea cortada.
          cut: name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1,
          flagWidth: flag ? flag.getBoundingClientRect().width : null,
        };
      }),
    );
    // 16avos, octavos y cuartos de los dos lados.
    expect(slots).toHaveLength(56);
    expect(slots.filter((slot) => slot.cut).map((slot) => slot.name)).toEqual([]);
    expect(slots.filter((slot) => slot.flagWidth !== 18).map((slot) => slot.name)).toEqual([]);
    await page
      .locator('.bracket-paper-board')
      .screenshot({ path: testInfo.outputPath(`cuadro-${width}.png`) });
  });
}

test('en móvil las jornadas se guardan al pulsar, sin ningún botón de guardar', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  const writes = await mockPredictionApp(page, LEAGUES.matchday);
  await page.goto('/jornadas');

  await expect(page.getByText('Real Madrid').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /guardar/i })).toHaveCount(0);

  await page.getByRole('button', { name: /^Predecir 1 en Real Madrid/ }).click();

  await expect.poll(() => writes).toContain('POST /api/predictions/matchday');
  await expect(page.getByRole('button', { name: /guardar/i })).toHaveCount(0);
});

test.describe('cuadro propio en móvil', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
  });

  test('el equipo sin rival «pasa directo» y la final queda por encima de la barra inferior', async ({
    page,
  }) => {
    await mockPredictionApp(page, LEAGUES.custom);
    await page.goto('/prediction');

    const bracket = page.locator('.mobile-bracket');
    await bracket.getByRole('tab', { name: 'Cuartos' }).click();
    await expect(bracket.getByText('Blancos', { exact: true }).first()).toBeVisible();
    await expect(bracket.getByText('Pasa directo').first()).toBeVisible();
    await expect(page.getByText('Descanso')).toHaveCount(0);

    await bracket.getByRole('tab', { name: /final/i }).click();
    const final = bracket.locator('.finale-final');
    await expect(final.getByRole('heading', { name: 'La gran final' })).toBeVisible();
    await scrollToEnd(page);
    const finalBox = (await final.boundingBox())!;
    const navBox = (await page.getByRole('navigation', { name: /móvil/ }).boundingBox())!;
    expect(finalBox.y + finalBox.height).toBeLessThanOrEqual(navBox.y);
  });

  test('avisa al salir con el cuadro a medias: al cambiar de pantalla y al cerrar la pestaña', async ({
    page,
  }) => {
    await mockPredictionApp(page, LEAGUES.custom);
    await page.goto('/prediction');
    const nav = page.getByRole('navigation', { name: /móvil/ });

    await page.getByRole('button', { name: 'Pasar a Rojos' }).first().click();
    await nav.getByRole('link', { name: 'Ranking' }).click();

    const dialog = page.getByRole('alertdialog', { name: '¿Salir sin guardar?' });
    await expect(dialog).toContainText('no se guarda hasta completar el cuadro');
    await dialog.getByRole('button', { name: 'Seguir aquí' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/prediction$/);
    await expect(page.getByRole('button', { name: 'Pasar a Rojos' }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Cerrar o recargar la pestaña: el navegador pide confirmación.
    const browserDialog = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    const leaving = await browserDialog;
    expect(leaving.type()).toBe('beforeunload');
    await leaving.dismiss();

    await nav.getByRole('link', { name: 'Ranking' }).click();
    await dialog.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/ranking$/);
  });

  test('sin tocar nada se sale sin preguntar', async ({ page }) => {
    await mockPredictionApp(page, LEAGUES.custom);
    await page.goto('/prediction');
    await expect(page.locator('.mobile-bracket')).toBeVisible();

    await page
      .getByRole('navigation', { name: /móvil/ })
      .getByRole('link', { name: 'Ranking' })
      .click();

    await expect(page).toHaveURL(/\/ranking$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
});
