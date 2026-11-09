import spaPageController from '../../../backend/src/main/java/app/porrapp/controller/SpaPageController.java?raw';
import appSource from '../App.tsx?raw';
import indexHtml from '../../index.html?raw';
import { describe, expect, it } from 'vitest';
import {
  APP_PATHS,
  CONTENT_PAGES,
  HOME_META,
  INDEXABLE_PATHS,
  LANDING_COPY,
  ROUTE_META,
} from '../seo/pages';

/** Rutas de un `Set.of(...)` de SpaPageController.java. */
const javaSet = (name: string) => {
  const match = spaPageController.match(new RegExp(`${name} = Set\\.of\\(([^;]*)\\);`));
  if (!match) throw new Error(`SpaPageController no define ${name}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(([, path]) => path).sort();
};

const allCopy = () => JSON.stringify([HOME_META, LANDING_COPY, CONTENT_PAGES, ROUTE_META]);

describe('seo pages', () => {
  it('matches the pages the server indexes and keeps out of search', () => {
    expect(javaSet('INDEXABLE')).toEqual([...INDEXABLE_PATHS].sort());
    expect(javaSet('APP')).toEqual([...APP_PATHS].sort());
  });

  it('classifies every route of the app', () => {
    const known = new Set([...INDEXABLE_PATHS, ...APP_PATHS]);
    const routes = [...appSource.matchAll(/path="([^"]+)"/g)]
      .map(([, path]) => path)
      .filter(
        (path) =>
          path !== '*' &&
          !path.startsWith('/join/') &&
          !path.startsWith('/marcador/:') &&
          !path.startsWith('/marcador/unirse/'),
      );
    expect(routes.filter((path) => !known.has(path))).toEqual([]);
  });

  it('serves the home description from index.html until the app mounts', () => {
    expect(indexHtml).toContain(`<title>${HOME_META.title}</title>`);
    expect(indexHtml.match(new RegExp(HOME_META.description, 'g'))).toHaveLength(4);
  });

  it('keeps titles and descriptions within what search results show', () => {
    for (const page of [HOME_META, ...CONTENT_PAGES, ...Object.values(ROUTE_META)]) {
      expect(page.title.length).toBeLessThanOrEqual(65);
      expect(page.description.length).toBeLessThanOrEqual(165);
    }
  });

  it('speaks of predictions, never of bets, and uses no em dashes', () => {
    expect(allCopy()).not.toMatch(/apuesta|apostar|\bbet\b|—/i);
  });
});
