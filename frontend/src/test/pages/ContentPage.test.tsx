import { render, screen, within } from '@testing-library/react';
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
