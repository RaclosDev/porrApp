/**
 * Páginas públicas y sus metadatos. Lo usan la app (título y metas al navegar, páginas de
 * contenido) y la build (HTML prerenderizado y sitemap, en seo/prerender.ts), así que el texto
 * que lee un buscador sin JavaScript es el mismo que se pinta. Sin dependencias del navegador.
 *
 * Las listas de rutas deben coincidir con SpaPageController.java; un test lo comprueba.
 */

export const SITE_ORIGIN = 'https://porrapp.app';

/**
 * Uso nominativo de las marcas: competiciones, equipos y deportistas se nombran y se ven en las
 * capturas de la app solo para identificarlos. Va en el pie de todas las páginas públicas y en su
 * HTML prerenderizado.
 */
export const AFFILIATION_NOTICE =
  'PorrApp no está afiliada a LaLiga, la UEFA, la FIFA, la Premier League, la RFEF, la Fórmula 1, la UFC, la NBA, la NFL, la ATP ni la WTA, ni cuenta con su patrocinio. Los nombres, escudos e imágenes de competiciones, equipos y deportistas pertenecen a sus titulares y se muestran solo para identificarlos.';

import { CONTENT_PAGES } from './content';
import type { AppScreen, FaqEntry, PageMeta, PageScreens } from './content/shared';

export { CONTENT_PAGES };
export type { ContentPage, FaqEntry, PageMeta, PageScreens } from './content/shared';

export const HOME_META: PageMeta = {
  title: 'Porra entre amigos gratis de fútbol, F1, UFC y más · PorrApp',
  description:
    'Crea gratis una porra entre amigos de LaLiga, la Champions, la F1, la UFC, la NBA o el tenis. Los puntos y la clasificación se calculan solos.',
};

/** Textos de la portada que también van en su HTML prerenderizado. */
export const LANDING_COPY = {
  h1: 'La porra con tus amigos,',
  h1Marked: 'pero bien hecha.',
  lede: 'Porras gratis con tus amigos de fútbol, Fórmula 1, UFC, NBA, NFL y tenis. Predice LaLiga jornada a jornada, el podio de cada Gran Premio o el ganador de cada combate. Los puntos se calculan solos con los resultados reales.',
  heroNote:
    'Entras con Google o con tu email. Sin anuncios y sin pasar por la tienda de apps: se instala desde el navegador como una app.',
  stepsTitle: 'Cómo se juega',
  steps: [
    {
      title: 'Crea tu liga',
      text: 'Elige el deporte y el formato: las jornadas de LaLiga o la Premier, el cuadro de unas eliminatorias, los Grandes Premios de la F1, las veladas de la UFC y más.',
    },
    {
      title: 'Invita con un enlace',
      text: 'Pásalo por el grupo. Tus amigos lo abren, entran con Google o con su email y ya están dentro.',
    },
    {
      title: 'Predice y compite',
      text: 'Cada predicción se cierra cuando empieza el partido. Los puntos y la clasificación se actualizan solos con los resultados reales.',
    },
  ],
  screensTitle: 'Así se ve en el móvil',
  formatsTitle: 'Una porra para cada deporte',
  sports: [
    { path: '/porra-laliga', name: 'LaLiga', text: 'Cada jornada, a 1X2 o a marcador exacto.' },
    { path: '/porra-champions', name: 'Champions', text: 'Partido a partido, hasta la final.' },
    {
      path: '/porra-premier-league',
      name: 'Premier League',
      text: 'La liga inglesa, jornada a jornada.',
    },
    {
      path: '/porra-copa-del-rey',
      name: 'Copa del Rey',
      text: 'Eliminatoria a eliminatoria, hasta la final.',
    },
    {
      path: '/porra-mundial',
      name: 'Mundial',
      text: 'El cuadro completo hasta el campeón, con pichichi.',
    },
    {
      path: '/porra-f1',
      name: 'Fórmula 1',
      text: 'Podio, pole y vuelta rápida de cada Gran Premio.',
    },
    { path: '/porra-ufc', name: 'UFC', text: 'Ganador, método y asalto de cada combate.' },
    { path: '/porra-nba', name: 'NBA', text: 'Temporada regular y playoffs.' },
    { path: '/porra-nfl', name: 'NFL', text: 'Los partidos de cada semana.' },
    { path: '/porra-tenis', name: 'Tenis', text: 'Grand Slams y Masters 1000.' },
  ],
  bracketTitle: 'Cuadro',
  bracketText:
    'Para las eliminatorias, como la Champions o el Mundial. Rellenas los cruces hasta el campeón y los puntos llegan solos con cada partido.',
  matchdayTitle: 'Jornadas',
  matchdayText:
    'Para LaLiga, la Premier, la Champions y otras ocho competiciones. Predices el signo (1X2) o el marcador exacto, según elija la liga, y cada partido se cierra solo cuando empieza.',
  closingTitle: 'Tu grupo ya discute de deporte.',
  closingMarked: 'Que cuente para algo.',
  closing:
    'Crea la liga, pasa el enlace y que hablen los resultados. Se instala en el móvil como una app.',
} as const;

const landingShot = (slug: string): AppScreen => {
  const shot = CONTENT_PAGES.flatMap((page) => page.screens?.shots ?? []).find((item) =>
    item.src.endsWith(`/${slug}`),
  );
  if (!shot) throw new Error(`Falta la captura ${slug}`);
  return shot;
};

/** Capturas de móvil de la portada: tres deportes, con el texto alternativo de su página. */
export const LANDING_SCREENS: PageScreens = {
  title: LANDING_COPY.screensTitle,
  shots: ['f1-carreras', 'laliga-jornada', 'ufc-cartelera'].map(landingShot),
};

/** Preguntas de la portada: van en su HTML prerenderizado y en sus datos estructurados (FAQPage). */
export const HOME_FAQ: FaqEntry[] = [
  {
    question: '¿PorrApp es gratis?',
    answer:
      'Sí. Crear ligas, invitar a tus amigos y jugar es gratis, sin anuncios ni planes de pago. PorrApp no mueve dinero: si jugáis con bote, se gestiona fuera de la app.',
  },
  {
    question: '¿De qué deportes puedo hacer una porra?',
    answer:
      'De fútbol (LaLiga, la Champions, la Premier, la Copa del Rey, el Mundial y otras ligas), Fórmula 1, UFC, NBA, NFL y tenis.',
  },
  {
    question: '¿Hay que instalar algo?',
    answer:
      'No. Funciona en el navegador del móvil o del ordenador. Si quieres, puedes añadirla a la pantalla de inicio y se abre como una app.',
  },
  {
    question: '¿Hay app de PorrApp para Android y iPhone?',
    answer:
      'Sí, sin pasar por la tienda: PorrApp es una app web (PWA). La abres en el navegador y la instalas en la pantalla de inicio, en Android y en iPhone, con su icono y a pantalla completa. Ocupa casi nada y se actualiza sola.',
  },
  {
    question: '¿Cómo entran mis amigos?',
    answer:
      'Les mandas el enlace de invitación de la liga, o el código si ya tienen cuenta. Entran con Google, con su email o con una llave de acceso.',
  },
  {
    question: '¿Y si prefiero llevar la porra en Excel?',
    answer:
      'Tenemos una plantilla gratis con los puntos y la clasificación ya calculados. Aunque con PorrApp no tendrás que apuntar ningún resultado.',
  },
];

/** Títulos de las pantallas de la app y de las páginas legales. */
export const ROUTE_META: Record<string, PageMeta> = {
  '/demo': {
    title: 'Demo de PorrApp · Mira una porra sin registrarte',
    description:
      'Prueba PorrApp sin registrarte: la porra pública del Mundial en modo de solo lectura.',
  },
  '/privacidad': {
    title: 'Política de privacidad · PorrApp',
    description: 'Qué datos guarda PorrApp, para qué los usa, quién los ve y qué derechos tienes.',
  },
  '/aviso-legal': {
    title: 'Aviso legal · PorrApp',
    description: 'Titular de PorrApp, uso del servicio y responsabilidad sobre los resultados.',
  },
  '/ranking': { title: 'Clasificación · PorrApp', description: HOME_META.description },
  '/jornadas': { title: 'Jornada · PorrApp', description: HOME_META.description },
  '/mis-ligas': { title: 'Mis ligas · PorrApp', description: HOME_META.description },
  '/crear-liga': { title: 'Crear liga · PorrApp', description: HOME_META.description },
  '/marcador/nuevo': { title: 'Nuevo marcador · PorrApp', description: HOME_META.description },
  '/bracket': { title: 'Cuadro oficial · PorrApp', description: HOME_META.description },
  '/prediction': { title: 'Mi porra · PorrApp', description: HOME_META.description },
  '/stats': { title: 'Estadísticas · PorrApp', description: HOME_META.description },
  '/search': { title: 'Buscador · PorrApp', description: HOME_META.description },
  '/radar': { title: 'Radar · PorrApp', description: HOME_META.description },
  '/tabla': { title: 'Tabla de la liga · PorrApp', description: HOME_META.description },
  '/grupos': { title: 'Grupos · PorrApp', description: HOME_META.description },
  '/partida': { title: 'Partida · PorrApp', description: HOME_META.description },
  '/historico': { title: 'Histórico · PorrApp', description: HOME_META.description },
  '/poker/mesa': { title: 'Mesa de póker · PorrApp', description: HOME_META.description },
  '/poker/historico': { title: 'Histórico de póker · PorrApp', description: HOME_META.description },
  '/poker/estadisticas': {
    title: 'Estadísticas de póker · PorrApp',
    description: HOME_META.description,
  },
  '/restablecer-contrasena': {
    title: 'Nueva contraseña · PorrApp',
    description: HOME_META.description,
  },
  '/gestion-7k2q': { title: 'PorrApp', description: HOME_META.description },
};

/** Páginas que pueden aparecer en los buscadores y van al sitemap. */
export const INDEXABLE_PATHS = [
  '/',
  ...CONTENT_PAGES.map((page) => page.path),
  '/privacidad',
  '/aviso-legal',
];

/** Pantallas de la app: el servidor las sirve con noindex. */
export const APP_PATHS = [
  '/demo',
  '/linkedin',
  '/radar',
  '/ranking',
  '/clasificacion',
  '/grupos',
  '/stats',
  '/search',
  '/mis-ligas',
  '/crear-liga',
  '/marcador/nuevo',
  '/torneos/nuevo',
  '/poker/nueva',
  '/poker/mesa',
  '/poker/historico',
  '/poker/estadisticas',
  '/bracket',
  '/tabla',
  '/prediction',
  '/jornadas',
  '/partida',
  '/historico',
  '/restablecer-contrasena',
  '/gestion-7k2q',
];

export const metaForPath = (path: string): PageMeta =>
  CONTENT_PAGES.find((page) => page.path === path) ?? ROUTE_META[path] ?? HOME_META;
