import type { Plugin, Rolldown } from 'vite';
import {
  CONTENT_PAGES,
  HOME_META,
  INDEXABLE_PATHS,
  LANDING_COPY,
  ROUTE_META,
  SITE_ORIGIN,
  type ContentPage,
  type PageMeta,
} from '../src/seo/pages.ts';

/**
 * Prerender de las páginas públicas en la build. Una SPA sirve el mismo HTML vacío en todas las
 * rutas, así que un buscador sin JavaScript (y las previsualizaciones al compartir) no ve nada.
 * Este plugin escribe un HTML por página pública con su título, descripción, canonical, Open
 * Graph y el texto de la página dentro de #root, y genera el sitemap. React sustituye ese
 * contenido al montar; mientras tanto lo tapa la pantalla de arranque, así que no se ve doble.
 * El texto sale de src/seo/pages.ts, el mismo que pinta la app.
 */

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const replaceOrFail = (html: string, pattern: RegExp, replacement: string, what: string) => {
  if (!pattern.test(html)) {
    throw new Error(`seoPrerender: index.html no tiene ${what}`);
  }
  return html.replace(pattern, replacement);
};

const setMeta = (html: string, attribute: 'name' | 'property', key: string, value: string) =>
  replaceOrFail(
    html,
    new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`),
    `$1${escapeHtml(value)}$2`,
    `<meta ${attribute}="${key}">`,
  );

const withHead = (html: string, meta: PageMeta, url: string | null, extraHead = '') => {
  let out = replaceOrFail(
    html,
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(meta.title)}</title>`,
    '<title>',
  );
  out = setMeta(out, 'name', 'description', meta.description);
  out = setMeta(out, 'property', 'og:title', meta.title);
  out = setMeta(out, 'property', 'og:description', meta.description);
  out = setMeta(out, 'name', 'twitter:title', meta.title);
  out = setMeta(out, 'name', 'twitter:description', meta.description);
  if (url) {
    out = setMeta(out, 'property', 'og:url', url);
    extraHead = `    <link rel="canonical" href="${url}" />\n${extraHead}`;
  }
  return extraHead
    ? out.replace(
        '</head>',
        `
${extraHead}  </head>`,
      )
    : out;
};

const withRoot = (html: string, content: string) =>
  replaceOrFail(
    html,
    /<div id="root"><\/div>/,
    `<div id="root">${content}</div>`,
    '<div id="root"></div>',
  );

const jsonLd = (data: unknown) =>
  `    <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n`;

const footerNav = () => {
  const links = [
    ...CONTENT_PAGES.map((page) => [page.path, page.navLabel]),
    ['/', 'PorrApp'],
    ['/privacidad', 'Privacidad'],
    ['/aviso-legal', 'Aviso legal'],
  ];
  return `<nav aria-label="Porras de PorrApp"><ul>${links
    .map(([href, label]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`)
    .join('')}</ul></nav>`;
};

const paragraphs = (texts: readonly string[]) =>
  texts.map((text) => `<p>${escapeHtml(text)}</p>`).join('');

const landingMarkup = () =>
  `<main><h1>${escapeHtml(`${LANDING_COPY.h1} ${LANDING_COPY.h1Marked}`)}</h1>` +
  paragraphs([LANDING_COPY.lede, LANDING_COPY.heroNote]) +
  `<p><a href="/demo">Ver una porra de ejemplo</a></p>` +
  `<h2>${escapeHtml(LANDING_COPY.stepsTitle)}</h2><ol>${LANDING_COPY.steps
    .map((step) => `<li><h3>${escapeHtml(step.title)}</h3>${paragraphs([step.text])}</li>`)
    .join('')}</ol>` +
  `<h2>${escapeHtml(LANDING_COPY.formatsTitle)}</h2>` +
  `<h3>${escapeHtml(LANDING_COPY.bracketTitle)}</h3>${paragraphs([LANDING_COPY.bracketText])}` +
  `<h3>${escapeHtml(LANDING_COPY.matchdayTitle)}</h3>${paragraphs([LANDING_COPY.matchdayText])}` +
  `<h2>${escapeHtml(`${LANDING_COPY.closingTitle} ${LANDING_COPY.closingMarked}`)}</h2>` +
  paragraphs([LANDING_COPY.closing]) +
  `</main>${footerNav()}`;

const contentMarkup = (page: ContentPage) =>
  `<main><h1>${escapeHtml(`${page.h1} ${page.h1Marked}`)}</h1>` +
  paragraphs([page.lede]) +
  `<p><a href="/demo">Ver una porra de ejemplo</a></p>` +
  page.sections
    .map((section) => `<h2>${escapeHtml(section.heading)}</h2>${paragraphs(section.paragraphs)}`)
    .join('') +
  (page.faq
    ? `<h2>Preguntas frecuentes</h2><dl>${page.faq
        .map(
          (entry) => `<dt>${escapeHtml(entry.question)}</dt><dd>${escapeHtml(entry.answer)}</dd>`,
        )
        .join('')}</dl>`
    : '') +
  `</main>${footerNav()}`;

const contentStructuredData = (page: ContentPage) => {
  const url = `${SITE_ORIGIN}${page.path}`;
  const graph: unknown[] = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PorrApp', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: page.navLabel, item: url },
      ],
    },
  ];
  if (page.faq) {
    graph.push({
      '@type': 'FAQPage',
      url,
      mainEntity: page.faq.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    });
  }
  return jsonLd({ '@context': 'https://schema.org', '@graph': graph });
};

/**
 * Chunk de una página cargada con React.lazy y todo lo que importa, para pedirlos a la vez que el
 * JS principal en vez de esperar a que este arranque y los descubra.
 */
const modulePreloads = (bundle: Rolldown.OutputBundle, html: string, moduleSuffix: string) => {
  const chunks = Object.values(bundle).filter(
    (item): item is Rolldown.OutputChunk => item.type === 'chunk',
  );
  const page = chunks.find((chunk) => chunk.facadeModuleId?.endsWith(moduleSuffix));
  if (!page) {
    throw new Error(`seoPrerender: no hay chunk para ${moduleSuffix}`);
  }
  const files = new Set<string>();
  const visit = (fileName: string) => {
    if (files.has(fileName)) return;
    files.add(fileName);
    const chunk = bundle[fileName];
    if (chunk?.type === 'chunk') chunk.imports.forEach(visit);
  };
  visit(page.fileName);
  return [...files]
    .filter((file) => !html.includes(`/${file}"`))
    .map((file) => `    <link rel="modulepreload" crossorigin href="/${file}" />\n`)
    .join('');
};

const sitemap = (lastmod: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${INDEXABLE_PATHS.map(
    (path) =>
      `  <url>\n    <loc>${SITE_ORIGIN}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n`,
  ).join('')}</urlset>\n`;

export default function seoPrerender(): Plugin {
  return {
    name: 'porrapp-seo-prerender',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'] as Rolldown.OutputAsset | undefined;
      if (!index || typeof index.source !== 'string') {
        throw new Error('seoPrerender: falta index.html en la build');
      }
      const shell = index.source;

      // La portada: sin canonical, porque este mismo HTML es el que reciben las pantallas de la
      // app sin HTML propio (ver RouteHead).
      index.source = withRoot(
        withHead(shell, HOME_META, null, modulePreloads(bundle, shell, '/src/pages/Landing.tsx')),
        landingMarkup(),
      );

      const contentPreloads = modulePreloads(bundle, shell, '/src/pages/ContentPage.tsx');
      for (const page of CONTENT_PAGES) {
        const url = `${SITE_ORIGIN}${page.path}`;
        this.emitFile({
          type: 'asset',
          fileName: `${page.path.slice(1)}/index.html`,
          source: withRoot(
            withHead(shell, page, url, contentPreloads + contentStructuredData(page)),
            contentMarkup(page),
          ),
        });
      }

      for (const path of ['/privacidad', '/aviso-legal']) {
        this.emitFile({
          type: 'asset',
          fileName: `${path.slice(1)}/index.html`,
          source: withHead(shell, ROUTE_META[path], `${SITE_ORIGIN}${path}`),
        });
      }

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemap(new Date().toISOString().slice(0, 10)),
      });
    },
  };
}
