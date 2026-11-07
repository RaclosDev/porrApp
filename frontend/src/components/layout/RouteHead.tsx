import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_ORIGIN, metaForPath } from '../../seo/pages';

const upsertMeta = (attribute: 'name' | 'property', key: string, content: string) => {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.content = content;
};

/**
 * Mantiene la cabecera de la página al navegar: título, descripción, Open Graph y
 * <link rel="canonical"> de la ruta actual en porrapp.app, sin query ni hash, para que Google no
 * trate como duplicadas las variantes de una misma página. index.html no lleva canonical a
 * propósito: lo comparten todas las rutas sin HTML propio, y Google ignora un canonical que el
 * JavaScript cambia a otro valor distinto del HTML servido. Las páginas prerenderizadas ya
 * llegan con el suyo, que aquí se reescribe con el mismo valor.
 */
export default function RouteHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const url = `${SITE_ORIGIN}${path}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;

    const { title, description } = metaForPath(path);
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
  }, [pathname]);

  return null;
}
