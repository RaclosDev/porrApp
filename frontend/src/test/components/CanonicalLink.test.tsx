import indexHtml from '../../../index.html?raw';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import CanonicalLink from '../../components/layout/CanonicalLink';

const canonicalHref = () =>
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

describe('CanonicalLink', () => {
  afterEach(() => {
    document.head.querySelectorAll('link[rel="canonical"]').forEach((link) => link.remove());
  });

  it('creates the canonical for the current route without query or trailing slash', () => {
    render(
      <MemoryRouter initialEntries={['/demo/?utm_source=x#top']}>
        <CanonicalLink />
      </MemoryRouter>,
    );
    expect(canonicalHref()).toBe('https://porrapp.app/demo');
  });

  it('points the home page at the site root', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <CanonicalLink />
      </MemoryRouter>,
    );
    expect(canonicalHref()).toBe('https://porrapp.app/');
  });

  it('is not hardcoded in index.html, which every route shares', () => {
    expect(indexHtml).not.toMatch(/rel="canonical"/);
  });
});
