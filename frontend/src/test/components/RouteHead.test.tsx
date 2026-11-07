import indexHtml from '../../../index.html?raw';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import RouteHead from '../../components/layout/RouteHead';
import { HOME_META } from '../../seo/pages';

const canonicalHref = () =>
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

const metaContent = (selector: string) =>
  document.head.querySelector<HTMLMetaElement>(selector)?.content;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RouteHead />
    </MemoryRouter>,
  );

describe('RouteHead', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('link[rel="canonical"], meta[name], meta[property]')
      .forEach((node) => node.remove());
  });

  it('creates the canonical for the current route without query or trailing slash', () => {
    renderAt('/demo/?utm_source=x#top');
    expect(canonicalHref()).toBe('https://porrapp.app/demo');
  });

  it('points the home page at the site root', () => {
    renderAt('/');
    expect(canonicalHref()).toBe('https://porrapp.app/');
    expect(document.title).toBe(HOME_META.title);
  });

  it('gives each content page its own title, description and Open Graph', () => {
    renderAt('/porra-laliga');
    expect(document.title).toBe('Porra de LaLiga con amigos, gratis · PorrApp');
    expect(metaContent('meta[name="description"]')).toMatch(/porra de LaLiga/);
    expect(metaContent('meta[property="og:title"]')).toBe(document.title);
    expect(metaContent('meta[property="og:url"]')).toBe('https://porrapp.app/porra-laliga');
  });

  it('names the app screens instead of repeating the home title', () => {
    renderAt('/ranking');
    expect(document.title).toBe('Clasificación · PorrApp');
  });

  it('is not hardcoded in index.html, which every route shares', () => {
    expect(indexHtml).not.toMatch(/rel="canonical"/);
  });
});
