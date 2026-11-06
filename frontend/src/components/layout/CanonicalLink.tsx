import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_ORIGIN = 'https://porrapp.app';

/**
 * Mantiene <link rel="canonical"> apuntando a la ruta actual en porrapp.app, sin query ni
 * hash, para que Google no trate como duplicadas las variantes de una misma página.
 */
export default function CanonicalLink() {
  const { pathname } = useLocation();

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`;
  }, [pathname]);

  return null;
}
