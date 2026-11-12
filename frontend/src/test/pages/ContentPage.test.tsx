import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ContentPage from '../../pages/ContentPage';
import { AFFILIATION_NOTICE, CONTENT_PAGES } from '../../seo/pages';

const pageAt = (path: string) => {
  const page = CONTENT_PAGES.find((candidate) => candidate.path === path);
  if (!page) throw new Error(`No hay página en ${path}`);
  return page;
};

const renderPage = (path: string) =>
  render(
    <MemoryRouter>
      <ContentPage page={pageAt(path)} />
    </MemoryRouter>,
  );

/** Capturas que hay en public/landing/porras, como `/landing/porras/ufc-inicio-600.webp`. */
const publishedShots = new Set(
  Object.keys(import.meta.glob('../../../public/landing/porras/*.webp')).map((file) =>
    file.replace('../../../public', ''),
  ),
);

describe('ContentPage', () => {
  it('la página de juegos de mesa deja probar la hoja de puntos sin cuenta', () => {
    renderPage('/apuntar-puntos-juegos-de-mesa');
    expect(screen.getByRole('link', { name: 'Probar la hoja de puntos' })).toHaveAttribute(
      'href',
      '#demo',
    );
    const table = screen.getByRole('table', { name: 'Hoja de puntos de ejemplo' });
    const totals = () => within(table).getByRole('row', { name: /Total/ });
    expect(totals()).toHaveTextContent('Total1822 ★ (va ganando)19');

    fireEvent.change(screen.getByLabelText('Puntos de Ana'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apuntar ronda' }));
    expect(totals()).toHaveTextContent('Total28 ★ (va ganando)2219');
    fireEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));
    expect(totals()).toHaveTextContent('Total1822 ★ (va ganando)19');
  });

  it('la página de timbas de póker explica el reloj, el bote y el reparto, y enlaza al resto', () => {
    renderPage('/timbas-de-poker');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Organiza la timba de póker desde el móvil.',
    );
    for (const heading of [
      'Reloj de ciegas que no se para',
      'Reparto de premios sin discusiones',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('¿PorrApp mueve el dinero de la timba?')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Apuntar puntos de juegos de mesa' })[0],
    ).toHaveAttribute('href', '/apuntar-puntos-juegos-de-mesa');
  });

  it('shows phone screenshots of a UFC league under the headline, with fixed size and alt text', () => {
    renderPage('/porra-ufc');

    const shots = within(screen.getByRole('region', { name: 'Así se ve una porra de la UFC' }))
      .getAllByRole('img')
      .map((img) => img as HTMLImageElement);
    expect(shots).toHaveLength(3);
    for (const img of shots) {
      expect(img.getAttribute('width')).toBe('600');
      expect(img.getAttribute('height')).toBe('1298');
      expect(img.getAttribute('srcset')).toMatch(/-300\.webp 300w, .*-600\.webp 600w$/);
      expect(img.alt.length).toBeGreaterThan(20);
    }
    expect(shots[1].alt).toMatch(/combate/);
  });

  it('says on every public page that PorrApp is not affiliated with the competitions', () => {
    renderPage('/porra-nba');
    expect(screen.getByText(AFFILIATION_NOTICE)).toBeInTheDocument();
    expect(AFFILIATION_NOTICE).toMatch(/no está afiliada a .*la NBA/);
  });

  it('leaves pages without screenshots as they were', () => {
    renderPage('/como-funciona');
    expect(screen.queryByRole('region', { name: /Así se ve/ })).not.toBeInTheDocument();
  });

  it('has both sizes of every screenshot in public/', () => {
    const shots = CONTENT_PAGES.flatMap((page) => page.screens?.shots ?? []);
    expect(shots.length).toBeGreaterThanOrEqual(29);
    for (const shot of shots) {
      expect(publishedShots).toContain(`${shot.src}-300.webp`);
      expect(publishedShots).toContain(`${shot.src}-600.webp`);
    }
  });
});
