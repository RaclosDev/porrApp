/** Tipos y textos comunes de las páginas públicas de contenido. */

export interface PageMeta {
  title: string;
  description: string;
}

interface ContentSection {
  heading: string;
  paragraphs: string[];
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/** Captura de la app en un móvil; `src` sin el sufijo de anchura (`-300.webp`, `-600.webp`). */
export interface AppScreen {
  src: string;
  alt: string;
}

/** Capturas de la app con partidos reales de la competición, debajo del titular. */
export interface PageScreens {
  title: string;
  shots: AppScreen[];
}

export const appScreen = (slug: string, alt: string): AppScreen => ({
  src: `/landing/porras/${slug}`,
  alt,
});

export interface ContentPage extends PageMeta {
  path: string;
  /** Nombre corto para los enlaces entre páginas. */
  navLabel: string;
  h1: string;
  /** Parte del titular que va subrayada a rotulador. */
  h1Marked: string;
  lede: string;
  sections: ContentSection[];
  faq?: FaqEntry[];
  screens?: PageScreens;
  /** Archivo que se descarga desde la página (la plantilla de Excel). */
  download?: { href: string; label: string };
  /** Hoja de juegos de mesa de prueba, para tocarla sin registrarse. */
  scoreboardDemo?: boolean;
  /** Liga de la demo con la que abre «Probar la demo» (`/demo?liga=…`); sin ella, la de siempre. */
  demoLeague?: string;
}

export const HOW_IT_WORKS_FAQ: FaqEntry[] = [
  {
    question: '¿Cuesta dinero?',
    answer:
      'No. Crear una liga, invitar a tus amigos y jugar es gratis. PorrApp no mueve dinero: si vuestra porra tiene bote, el administrador puede apuntar quién ha pagado, pero el dinero se gestiona fuera de la app.',
  },
  {
    question: '¿Hasta cuándo puedo cambiar una predicción?',
    answer:
      'En las ligas por jornadas, hasta que empieza cada partido: se cierra solo a su hora. En el cuadro del Mundial, hasta el inicio del torneo.',
  },
  {
    question: '¿Los demás ven mis predicciones?',
    answer:
      'Sí, pero no antes de tiempo. Cada predicción queda a la vista del resto de la liga cuando empieza el partido, así nadie copia a nadie.',
  },
  {
    question: '¿Cómo se calculan los puntos?',
    answer:
      'Con los resultados reales, en cuanto termina cada partido. El administrador de la liga decide cuántos puntos vale cada acierto; si cambia las reglas, los partidos ya jugados se vuelven a puntuar.',
  },
  {
    question: '¿Cómo invito a mis amigos?',
    answer:
      'Cada liga tiene un enlace y un código de invitación. Mandas el enlace por WhatsApp o donde queráis, tus amigos lo abren, entran con Google o con su email y ya están dentro. Si alguien ya tiene cuenta, también puede unirse con el código desde «Unirse con código».',
  },
  {
    question: '¿Hay que instalar algo?',
    answer:
      'No. PorrApp funciona en el navegador del móvil o del ordenador. Si quieres tenerla a mano, puedes añadirla a la pantalla de inicio y se abre como una app.',
  },
  {
    question: '¿Puedo jugar en varias ligas a la vez?',
    answer:
      'Sí. Puedes estar en todas las ligas que quieras, de la misma competición o de otras, y cada una lleva su propia clasificación.',
  },
];

/** Respuesta común de las páginas por deporte. */
export const FREE_ANSWER =
  'Nada. Crear la liga, invitar a tus amigos y jugar es gratis, y no hay que instalar nada: funciona en el navegador del móvil. PorrApp no mueve dinero; si jugáis con bote, se gestiona fuera de la app.';
