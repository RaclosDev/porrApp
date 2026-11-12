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
interface AppScreen {
  src: string;
  alt: string;
}

/** Capturas de la app con partidos reales de la competición, debajo del titular. */
export interface PageScreens {
  title: string;
  shots: AppScreen[];
}

const appScreen = (slug: string, alt: string): AppScreen => ({
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
}

export const HOME_META: PageMeta = {
  title: 'Porra con amigos gratis: fútbol, F1, UFC y más · PorrApp',
  description:
    'Crea gratis una porra con tus amigos de LaLiga, la Champions, la F1, la UFC, la NBA o el tenis. Los puntos y la clasificación se calculan solos.',
};

/** Textos de la portada que también van en su HTML prerenderizado. */
export const LANDING_COPY = {
  h1: 'La porra con tus amigos,',
  h1Marked: 'pero bien hecha.',
  lede: 'Porras gratis con tus amigos de fútbol, Fórmula 1, UFC, NBA, NFL y tenis. Predice LaLiga jornada a jornada, el podio de cada Gran Premio o el ganador de cada combate. Los puntos se calculan solos con los resultados reales.',
  heroNote: 'Entras con Google o con tu email. Sin descargas ni anuncios.',
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
  formatsTitle: 'Dos formas de jugar',
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

const HOW_IT_WORKS_FAQ: FaqEntry[] = [
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
const FREE_ANSWER =
  'Nada. Crear la liga, invitar a tus amigos y jugar es gratis, y no hay que instalar nada: funciona en el navegador del móvil. PorrApp no mueve dinero; si jugáis con bote, se gestiona fuera de la app.';

export const CONTENT_PAGES: ContentPage[] = [
  {
    path: '/como-funciona',
    navLabel: 'Cómo funciona',
    title: 'Cómo hacer una porra de fútbol con amigos · PorrApp',
    description:
      'Así funciona PorrApp: creas una liga, invitas a tus amigos con un enlace, cada uno hace sus predicciones y los puntos se calculan solos con los resultados reales.',
    h1: 'Cómo montar una porra',
    h1Marked: 'con tus amigos.',
    lede: 'Una porra de fútbol de las de siempre, sin hojas de cálculo ni cuentas a mano: cada uno hace sus predicciones desde el móvil y la clasificación se actualiza sola.',
    sections: [
      {
        heading: 'Crea la liga',
        paragraphs: [
          'Entra con Google o con tu email y crea una liga privada. Eliges la competición (LaLiga, la Premier, la Champions y otras) y el formato: predicciones jornada a jornada o el cuadro de unas eliminatorias.',
          'Quien crea la liga es su administrador: puede cambiar los puntos de cada acierto, gestionar a los miembros y apuntar quién ha pagado si jugáis con bote.',
        ],
      },
      {
        heading: 'Invita a tus amigos',
        paragraphs: [
          'Comparte el enlace de invitación por WhatsApp o por donde soléis hablar. Al abrirlo, cada uno entra con Google o con su email y queda unido a la liga.',
          'Si alguien ya tiene cuenta en PorrApp, le basta el código de invitación: lo escribe en «Unirse con código», desde el selector de liga o desde Mis ligas.',
        ],
      },
      {
        heading: 'Haz tus predicciones',
        paragraphs: [
          'En las ligas por jornadas predices cada partido: el signo (1X2) o el marcador exacto, según elija la liga. Puedes cambiarlo hasta que empieza: a esa hora se cierra solo y tu predicción queda a la vista del resto.',
          'En el cuadro del Mundial ordenas los grupos, rellenas las eliminatorias hasta el campeón y eliges al pichichi antes de que empiece el torneo.',
        ],
      },
      {
        heading: 'Sigue la clasificación',
        paragraphs: [
          'Los puntos llegan solos con los resultados reales. Tienes la clasificación general de la liga, la de cada jornada y, en cada partido, qué eligió cada uno y cuántos acertaron.',
        ],
      },
    ],
    faq: HOW_IT_WORKS_FAQ,
  },
  {
    path: '/porra-laliga',
    navLabel: 'Porra de LaLiga',
    title: 'Porra de LaLiga con amigos, gratis · PorrApp',
    description:
      'Monta una porra de LaLiga con tus amigos: predicciones de cada jornada, cierre automático al empezar cada partido y clasificación al día. Gratis.',
    h1: 'Tu porra de LaLiga,',
    h1Marked: 'jornada a jornada.',
    lede: 'Crea una liga privada para la temporada de LaLiga, invita a tus amigos y predice cada partido, a 1X2 o a marcador exacto. Los puntos se suman solos cuando termina.',
    screens: {
      title: 'Así se ve una porra de LaLiga',
      shots: [
        appScreen(
          'laliga-inicio',
          'Inicio de una liga de LaLiga en PorrApp: resultados de la jornada 12, como el Valencia 0-3 Real Madrid, con el escudo de cada equipo.',
        ),
        appScreen(
          'laliga-jornada',
          'Jornada 12 de LaLiga en PorrApp: Real Sociedad-Rayo Vallecano y los demás partidos abiertos, con los botones 1, X y 2.',
        ),
        appScreen(
          'laliga-tabla',
          'Clasificación de LaLiga dentro de PorrApp, con Barcelona y Real Madrid arriba y los puntos de cada equipo.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Toda la temporada',
        paragraphs: [
          'PorrApp carga el calendario de LaLiga EA Sports con fechas y horarios reales. Cada jornada aparece en tu liga con sus partidos, y los resultados llegan en directo.',
          'No hace falta que nadie apunte resultados ni sume puntos: la clasificación de la liga y la de cada jornada se actualizan solas.',
        ],
      },
      {
        heading: 'Sin trampas',
        paragraphs: [
          'Cada partido se cierra a su hora de inicio, así que puedes dejar tu predicción del domingo para el domingo. Hasta que empieza, nadie ve lo que has elegido.',
          'Cuando el partido arranca, todas las predicciones quedan a la vista: quién fue con el local, quién se arriesgó con el empate y cuántos acertaron.',
        ],
      },
      {
        heading: 'A vuestra manera',
        paragraphs: [
          'El administrador decide cuántos puntos vale cada acierto. Si jugáis con bote, puede apuntar quién ha pagado; el dinero se queda fuera de la app.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Cómo se hace una porra de LaLiga con amigos?',
        answer:
          'Creas una liga privada de LaLiga, mandas el enlace de invitación por WhatsApp y cada uno hace sus predicciones de la jornada desde el móvil. Los resultados reales y los puntos llegan solos.',
      },
      {
        question: '¿Se predice el 1X2 o el resultado exacto?',
        answer:
          'Lo elige la liga: el signo de cada partido (1X2) o el marcador exacto. El administrador decide además cuántos puntos vale cada acierto.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/porra-champions',
    navLabel: 'Porra de la Champions',
    title: 'Porra de la Champions League con amigos · PorrApp',
    description:
      'Haz una porra de la Champions League con tus amigos: predicciones de cada partido, desde la fase de liga hasta la final, con puntos y clasificación automáticos.',
    h1: 'La porra de la Champions,',
    h1Marked: 'partido a partido.',
    lede: 'Martes y miércoles de Champions con algo más en juego: crea una liga privada, invita a tus amigos y predice cada partido de la UEFA Champions League.',
    screens: {
      title: 'Así se ve una porra de la Champions',
      shots: [
        appScreen(
          'champions-inicio',
          'Inicio de una liga de la Champions en PorrApp: resultados de la fase de liga, como el Barcelona 3-0 Aston Villa.',
        ),
        appScreen(
          'champions-jornada',
          'Partidos de la fase de liga de la Champions en PorrApp, como AEK-Real Madrid, con la predicción 1X2 de cada uno.',
        ),
        appScreen(
          'champions-tabla',
          'Clasificación de la fase de liga de la Champions dentro de PorrApp, con el escudo y los puntos de cada equipo.',
        ),
      ],
    },
    sections: [
      {
        heading: 'De la fase de liga a la final',
        paragraphs: [
          'Los partidos de la Champions llegan a tu liga con sus horarios reales. Predices cada uno, a 1X2 o a marcador exacto según la liga, y la predicción se cierra sola cuando empieza.',
          'La clasificación de la liga se actualiza con cada resultado, y también puedes ver quién ganó cada jornada.',
        ],
      },
      {
        heading: 'También Europa League y Conference',
        paragraphs: [
          'Si en tu grupo hay más ganas de fútbol europeo, puedes crear otra liga para la Europa League o la Conference League. Cada liga lleva su propia clasificación.',
        ],
      },
      {
        heading: 'Para ver los partidos juntos',
        paragraphs: [
          'En cuanto empieza el partido se ven las predicciones de todos, y al terminar, cuántos acertaron. Perfecto para comentarlo en el grupo mientras se juega.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Cómo se hace una porra de la Champions con amigos?',
        answer:
          'Creas una liga privada de la Champions League, invitas a tus amigos con un enlace y cada uno predice los partidos desde el móvil. Los resultados y la clasificación se actualizan solos.',
      },
      {
        question: '¿Entran las eliminatorias y la final?',
        answer:
          'Sí. Los partidos llegan desde la fase de liga hasta la final, cada uno con su horario real, y cada predicción se cierra cuando empieza el partido.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/porra-premier-league',
    navLabel: 'Porra de la Premier',
    title: 'Porra de la Premier League con amigos · PorrApp',
    description:
      'Crea una porra de la Premier League con tus amigos: predicciones de cada jornada, cierre automático al empezar cada partido y clasificación al día.',
    h1: 'Tu porra de la Premier,',
    h1Marked: 'sin hojas de cálculo.',
    lede: 'Crea una liga privada para la Premier League, invita a tus amigos y predice cada partido, a 1X2 o a marcador exacto. PorrApp se encarga de los resultados y los puntos.',
    screens: {
      title: 'Así se ve una porra de la Premier',
      shots: [
        appScreen(
          'premier-inicio',
          'Inicio de una liga de la Premier League en PorrApp: resultados de la jornada 10, como el Everton 3-1 Coventry City.',
        ),
        appScreen(
          'premier-jornada',
          'Jornada 10 de la Premier League en PorrApp: Crystal Palace-Liverpool y el resto, con la predicción 1X2 de cada partido.',
        ),
        appScreen(
          'premier-tabla',
          'Clasificación de la Premier League dentro de PorrApp, con el Arsenal líder.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Cada jornada, con su horario',
        paragraphs: [
          'Los partidos de la Premier llegan con sus horarios reales, también los de los sábados a mediodía. Cada uno se cierra a su hora, así que puedes predecir el último partido del lunes hasta el último momento.',
        ],
      },
      {
        heading: 'Más ligas, mismo grupo',
        paragraphs: [
          'PorrApp también tiene LaLiga, la Serie A, la Bundesliga, la Ligue 1 y otras competiciones. Puedes estar en varias ligas a la vez y cada una lleva su clasificación.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Cómo se hace una porra de la Premier League con amigos?',
        answer:
          'Creas una liga privada de la Premier, invitas a tus amigos con un enlace y cada uno predice los partidos de la jornada, a 1X2 o a marcador exacto. Los puntos se calculan solos.',
      },
      {
        question: '¿Podemos jugar a la vez la Premier y LaLiga?',
        answer:
          'Sí. Con el mismo grupo podéis tener una liga para cada competición, y cada una lleva su propia clasificación.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/porra-mundial',
    navLabel: 'Porra del Mundial',
    title: 'Porra del Mundial con cuadro y pichichi · PorrApp',
    description:
      'La porra del Mundial en PorrApp: ordenas los grupos, rellenas las eliminatorias hasta el campeón y eliges al pichichi. Mira cómo quedó la porra del Mundial 2026.',
    h1: 'La porra del Mundial,',
    h1Marked: 'con cuadro completo.',
    lede: 'En el Mundial no se predice partido a partido: se rellena el cuadro entero antes de que empiece, de la fase de grupos a la final, y se elige al máximo goleador.',
    screens: {
      title: 'Así se ve una porra del Mundial',
      shots: [
        appScreen(
          'mundial-inicio',
          'Inicio de la porra del Mundial 2026 en PorrApp: los últimos resultados, con la final España-Argentina.',
        ),
        appScreen(
          'mundial-resultados',
          'Cuadro del Mundial 2026 en PorrApp: semifinales y la gran final, con quién se clasifica y quién cae.',
        ),
        appScreen(
          'mundial-grupos',
          'Grupos del Mundial 2026 en PorrApp, con la tabla de cada grupo y qué selecciones pasan.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Cómo es el cuadro',
        paragraphs: [
          'Ordenas los equipos de cada grupo, eliges a los mejores terceros y los cruces se calculan solos. Después rellenas las eliminatorias ronda a ronda hasta el campeón, y al final eliges al pichichi.',
          'Los puntos llegan con cada partido: por acertar quién pasa de grupo y en qué puesto, por cada equipo que aciertas en cada ronda, por el podio y por el máximo goleador. El administrador de la liga puede cambiar cuánto vale cada acierto.',
        ],
      },
      {
        heading: 'El Mundial 2026',
        paragraphs: [
          'La porra del Mundial 2026 ya está cerrada. En la demo puedes ver los cuadros de la liga pública y cómo quedó la clasificación.',
          'Mientras llega el próximo gran torneo, puedes seguir jugando con tus amigos en ligas por jornadas de LaLiga, la Premier o la Champions.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Cómo funciona la porra del Mundial?',
        answer:
          'Antes de que empiece el torneo ordenas los grupos, rellenas las eliminatorias hasta el campeón y eliges al máximo goleador. Los puntos llegan con cada partido que se juega.',
      },
      {
        question: '¿Hasta cuándo se puede cambiar el cuadro?',
        answer:
          'Hasta el inicio del torneo. A partir de ahí el cuadro queda cerrado y se puntúa con los resultados reales.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/porra-f1',
    navLabel: 'Porra de F1',
    title: 'Porra de F1 con amigos: podio, pole y vuelta rápida · PorrApp',
    description:
      'Monta una porra de F1 con tus amigos: predice el podio, la pole y la vuelta rápida de cada Gran Premio. Puntos y clasificación automáticos, gratis.',
    h1: 'La porra de la F1,',
    h1Marked: 'Gran Premio a Gran Premio.',
    lede: 'Crea una liga privada de Fórmula 1, invita a tus amigos y predice cada carrera del Mundial: quién sube al podio, quién hace la pole y quién marca la vuelta rápida.',
    screens: {
      title: 'Así se ve una porra de la F1',
      shots: [
        appScreen(
          'f1-inicio',
          'Próximo Gran Premio en una liga de Fórmula 1 de PorrApp: en Las Vegas se elige el podio, la pole y la vuelta rápida.',
        ),
        appScreen(
          'f1-carreras',
          'GP de São Paulo ya disputado en PorrApp: el resultado real al lado de tu predicción y los puntos que ha dado.',
        ),
        appScreen(
          'f1-mundial',
          'Mundial de pilotos de Fórmula 1 dentro de PorrApp, con Kimi Antonelli líder y la diferencia de puntos de cada piloto.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Qué se predice',
        paragraphs: [
          'En cada Gran Premio eliges a los tres pilotos del podio en orden, al que saldrá desde la pole y al de la vuelta rápida. El administrador de la liga decide cuántos puntos vale cada acierto.',
        ],
      },
      {
        heading: 'Resultados y Mundial al día',
        paragraphs: [
          'Cuando termina la carrera llegan la clasificación completa y los puntos de tu liga. También tienes el Mundial de pilotos y el de constructores sin salir de la app.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Qué se predice en la porra de F1?',
        answer:
          'En cada Gran Premio, los tres pilotos del podio en orden, el que hace la pole y el de la vuelta rápida.',
      },
      {
        question: '¿Cómo se reparten los puntos?',
        answer:
          'El administrador de la liga decide cuánto vale cada acierto. Cuando termina la carrera llegan los resultados y la clasificación de la liga se actualiza sola.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/porra-ufc',
    navLabel: 'Porra de la UFC',
    title: 'Porra de la UFC con amigos: ganador, método y asalto · PorrApp',
    description:
      'Haz una porra de la UFC con tus amigos: predice quién gana cada combate, por KO, sumisión o decisión, y en qué asalto. Puntos y clasificación automáticos.',
    h1: 'La porra de la UFC,',
    h1Marked: 'combate a combate.',
    lede: 'Noches de UFC con algo en juego: crea una liga privada, invita a tus amigos y predice cada pelea de la cartelera, de los preliminares al combate estelar.',
    screens: {
      title: 'Así se ve una porra de la UFC',
      shots: [
        appScreen(
          'ufc-inicio',
          'Inicio de una liga de la UFC en PorrApp: los combates de la velada Cortes Acosta vs. Walker con la foto de cada luchador.',
        ),
        appScreen(
          'ufc-jornada',
          'Velada de la UFC en PorrApp: en cada combate, como Cortes Acosta contra Walker, se elige ganador y, si quieres, método.',
        ),
        appScreen(
          'ufc-cartelera',
          'Cartelera estelar de una velada de la UFC en PorrApp, con tus aciertos, tus puntos y tu predicción de cada pelea.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Ganador, método y asalto',
        paragraphs: [
          'En cada combate eliges al ganador y, si quieres arriesgar, cómo gana (KO/TKO, sumisión o decisión) y en qué asalto. Cuanto más afinas, más puntos.',
          'Las predicciones se cierran al empezar la velada o, si la liga lo prefiere, por bloques: los preliminares y la cartelera principal, cada uno a su hora.',
        ],
      },
      {
        heading: 'Elige qué veladas seguís',
        paragraphs: [
          'La liga puede seguir todas las veladas de la UFC, solo los eventos numerados o solo las Fight Nights. Las carteleras y los resultados llegan solos.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Qué se predice en la porra de la UFC?',
        answer:
          'El ganador de cada combate y, si quieres arriesgar, cómo gana (KO/TKO, sumisión o decisión) y en qué asalto. Cuanto más afinas, más puntos.',
      },
      {
        question: '¿Cuándo se cierran las predicciones?',
        answer:
          'Al empezar la velada o, si la liga lo prefiere, por bloques: los preliminares y la cartelera principal, cada uno a su hora.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/porra-nba',
    navLabel: 'Porra de la NBA',
    title: 'Porra de la NBA con amigos: temporada y playoffs · PorrApp',
    description:
      'Crea una porra de la NBA con tus amigos: predice los partidos de cada semana o las series de los playoffs, con puntos y clasificación automáticos.',
    h1: 'Tu porra de la NBA,',
    h1Marked: 'de octubre a junio.',
    lede: 'Crea una liga privada de la NBA, invita a tus amigos y predice quién gana cada partido de la temporada regular o cada serie de los playoffs.',
    screens: {
      title: 'Así se ve una porra de la NBA',
      shots: [
        appScreen(
          'nba-inicio',
          'Inicio de una liga de la NBA en PorrApp: resultados de la semana, como el Pacers 102-114 Nuggets, con el escudo de cada equipo.',
        ),
        appScreen(
          'nba-jornada',
          'Semana 3 de la NBA en PorrApp: en cada partido, como Pistons-Lakers, se elige qué equipo gana.',
        ),
        appScreen(
          'nba-tabla',
          'Clasificación de la NBA por conferencias dentro de PorrApp, con victorias y derrotas.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Temporada regular',
        paragraphs: [
          'Los partidos se agrupan por semanas y se cierran a su hora. Si preferís algo más corto e intenso, está el modo superviviente: un equipo ganador por semana y sin repetir.',
          'Tienes la clasificación de la NBA por conferencia y por división dentro de la app.',
        ],
      },
      {
        heading: 'Playoffs',
        paragraphs: [
          'En los playoffs predices quién gana cada serie y en cuántos partidos, desde el play-in hasta las Finales.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Qué se predice en la porra de la NBA?',
        answer:
          'En la temporada regular, quién gana cada partido de la semana. En los playoffs, quién gana cada serie y en cuántos partidos.',
      },
      {
        question: '¿Qué es el modo superviviente?',
        answer:
          'Cada semana eliges un equipo que creas que va a ganar, sin repetir equipo en toda la porra. Es una forma más corta e intensa de jugar la temporada.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/porra-nfl',
    navLabel: 'Porra de la NFL',
    title: 'Porra de la NFL con amigos, semana a semana · PorrApp',
    description:
      'Monta una porra de la NFL con tus amigos: predice el ganador de cada partido de la semana o juega al superviviente. Clasificación automática y gratis.',
    h1: 'La porra de la NFL,',
    h1Marked: 'semana a semana.',
    lede: 'Crea una liga privada de la NFL, invita a tus amigos y predice quién gana cada partido de la semana, del jueves al lunes por la noche.',
    screens: {
      title: 'Así se ve una porra de la NFL',
      shots: [
        appScreen(
          'nfl-inicio',
          'Inicio de una liga de la NFL en PorrApp: resultados de la semana 9, como el Ravens 10-33 Jaguars.',
        ),
        appScreen(
          'nfl-jornada',
          'Semana 9 de la NFL en PorrApp: en cada partido, como Chargers-Texans, se elige qué equipo gana.',
        ),
        appScreen(
          'nfl-tabla',
          'Clasificación de la NFL por divisiones dentro de PorrApp, con victorias, derrotas y puesto de playoffs.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Cada semana, sus partidos',
        paragraphs: [
          'Los partidos llegan con sus horarios reales y se cierran a su hora. La app te dice qué equipos descansan esa semana.',
          'Tienes la clasificación de la NFL por división y por conferencia, con el balance de cada equipo y los puestos de playoffs.',
        ],
      },
      {
        heading: 'Modo superviviente',
        paragraphs: [
          'Cada semana eliges un equipo que creas que va a ganar, sin repetir. Si pierde, pierdes una vida; el administrador decide cuántas tiene cada uno. El último en pie gana la liga.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Qué se predice en la porra de la NFL?',
        answer:
          'Quién gana cada partido de la semana, del jueves al lunes por la noche. Cada partido se cierra a su hora.',
      },
      {
        question: '¿Cómo funciona el modo superviviente?',
        answer:
          'Cada semana eliges un equipo que creas que va a ganar, sin repetir. Si pierde, pierdes una vida; el administrador decide cuántas tiene cada uno. El último en pie gana.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/porra-tenis',
    navLabel: 'Porra de tenis',
    title: 'Porra de tenis con amigos: Grand Slams y Masters 1000 · PorrApp',
    description:
      'Haz una porra de tenis con tus amigos: predice quién gana cada partido de los Grand Slams, los Masters 1000 y las Finals, en el cuadro masculino y el femenino.',
    h1: 'La porra de tenis,',
    h1Marked: 'torneo a torneo.',
    lede: 'Crea una liga privada de tenis, invita a tus amigos y predice los partidos de los grandes torneos de la ATP y la WTA, del Open de Australia a las Finals.',
    screens: {
      title: 'Así se ve una porra de tenis',
      shots: [
        appScreen(
          'tenis-inicio',
          'Inicio de una liga de tenis en PorrApp: las semifinales del Masters de París y la clasificación de la liga.',
        ),
        appScreen(
          'tenis-jornada',
          'Semifinales del Masters de París en PorrApp: en Van Assche-Shelton se elige quién gana y, si quieres, los sets.',
        ),
        appScreen(
          'tenis-cuadro',
          'Cuadro del Masters de París en PorrApp: octavos y cuartos de final con el resultado en sets de cada partido.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Qué torneos',
        paragraphs: [
          'La liga puede seguir toda la temporada, solo los Grand Slams o solo los Masters 1000 y las Finals, con el cuadro masculino, el femenino o los dos.',
        ],
      },
      {
        heading: 'Qué se predice',
        paragraphs: [
          'En cada partido eliges quién gana y, si quieres, por cuántos sets. El cuadro del torneo se va completando con los resultados reales y tus predicciones.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Qué torneos entran en la porra de tenis?',
        answer:
          'La liga puede seguir toda la temporada, solo los Grand Slams o solo los Masters 1000 y las Finals, con el cuadro masculino, el femenino o los dos.',
      },
      {
        question: '¿Qué se predice en cada partido?',
        answer:
          'Quién gana y, si quieres, por cuántos sets. El cuadro del torneo se va completando con los resultados reales.',
      },
      { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
    ],
  },
  {
    path: '/plantilla-porra-excel',
    navLabel: 'Plantilla de porra en Excel',
    title: 'Plantilla de porra en Excel gratis para tus amigos · PorrApp',
    description:
      'Descarga gratis una plantilla de porra en Excel o Google Sheets: predicciones por partido, puntos automáticos por resultado exacto y por signo, y clasificación.',
    h1: 'Plantilla de porra en Excel,',
    h1Marked: 'gratis.',
    lede: 'Una hoja lista para tu porra de LaLiga, la Champions o el Mundial: apuntas los partidos, cada uno pone su predicción y los puntos y la clasificación se calculan solos.',
    download: {
      href: '/plantillas/plantilla-porra-amigos.xlsx',
      label: 'Descargar la plantilla (.xlsx)',
    },
    sections: [
      {
        heading: 'Qué trae la plantilla',
        paragraphs: [
          'Una pestaña «Porra» con los partidos (jornada, local, visitante y resultado) y tres columnas por jugador: goles del local, goles del visitante y los puntos de ese partido. Caben ocho jugadores y doscientos partidos.',
          'Una pestaña «Puntos» donde decidís cuánto vale acertar el resultado exacto y cuánto acertar el signo (1X2). Por defecto, 3 y 1.',
          'Una pestaña «Clasificación» que suma los puntos de cada jugador y le da su puesto.',
        ],
      },
      {
        heading: 'Cómo se usa',
        paragraphs: [
          'Escribe los nombres de los jugadores en la primera fila y los partidos de la jornada. Antes de cada partido, cada uno rellena su predicción. Cuando acabe, escribe el resultado real: los puntos aparecen solos.',
          'Funciona en Excel, en LibreOffice y en Google Sheets: súbela a Google Drive y ábrela con Hojas de cálculo para compartirla con el grupo.',
        ],
      },
      {
        heading: 'Lo que una hoja de cálculo no hace',
        paragraphs: [
          'Alguien tiene que apuntar cada resultado, y cualquiera con acceso a la hoja puede cambiar su predicción con el partido empezado o ver las de los demás antes de decidir la suya.',
          'PorrApp hace lo mismo sin trabajo: los resultados reales llegan solos, cada predicción se cierra a la hora del partido y nadie ve las de los demás hasta que empieza. Es gratis y no hay que instalar nada.',
        ],
      },
    ],
    faq: [
      {
        question: '¿La plantilla es gratis?',
        answer: 'Sí. Descárgala, cópiala y cámbiala como quieras. No pide registro ni datos.',
      },
      {
        question: '¿Puedo usarla para el Mundial o la Champions?',
        answer:
          'Sí: sirve para cualquier competición de partidos, solo cambia los equipos. Para rellenar el cuadro entero del Mundial, PorrApp tiene un modo de cuadro con eliminatorias y pichichi.',
      },
      {
        question: '¿Y si somos más de ocho?',
        answer:
          'Copia las tres columnas del último jugador a la derecha y añade su fila en «Clasificación». O crea la porra en PorrApp, donde no hay límite de jugadores.',
      },
    ],
  },
  {
    path: '/alternativa-laporra',
    navLabel: 'Alternativa a La Porra',
    title: 'Alternativa gratis a La Porra (laporra.app), sin planes · PorrApp',
    description:
      'PorrApp frente a La Porra (laporra.app): qué comparten, en qué se diferencian en precio, deportes y formatos, y cuándo conviene cada una. Comparación honesta.',
    h1: 'Una alternativa a La Porra,',
    h1Marked: 'sin planes de pago.',
    lede: 'La Porra (laporra.app) es una buena app para hacer porras con amigos. Si buscas otra opción, esto es lo que cambia con PorrApp, contado sin trampas. Datos de La Porra consultados en su web el 8 de noviembre de 2026.',
    sections: [
      {
        heading: 'En resumen',
        paragraphs: [
          'Las dos son webs gratis para hacer porras privadas con amigos, con cierre automático al empezar cada partido y clasificación que se calcula sola.',
          'La Porra cubre más deportes (también MotoGP y golf) y calcula quién pone el bote cada jornada, pero su plan gratis llega a 3 porras a la vez y 100 miembros por porra; para más hay un plan Pro de 4,99 € al mes o uno de pago único de 99 €.',
          'PorrApp no tiene planes de pago: todo es gratis y sin anuncios. Además tiene formatos propios, como el cuadro completo del Mundial, el superviviente o la porra de la UFC con método y asalto.',
        ],
      },
      {
        heading: 'Precio',
        paragraphs: [
          'La Porra: gratis hasta 3 porras a la vez y 100 miembros por porra. Pro, 4,99 € al mes: porras ilimitadas y hasta 500 miembros. Lifetime, 99 € en un pago.',
          'PorrApp: gratis, sin planes ni tarjeta. Puedes estar en todas las ligas que quieras.',
        ],
      },
      {
        heading: 'Deportes y formatos',
        paragraphs: [
          'La Porra: fútbol (LaLiga, Champions, Premier, Copa del Rey…), F1, MotoGP, NBA, tenis, UFC, golf y NFL. En fútbol puntúa por resultado exacto, diferencia de goles y tendencia.',
          'PorrApp: LaLiga, la Champions, la Premier, la Copa del Rey y el Mundial; F1 (podio, pole y vuelta rápida), UFC (ganador, método y asalto), NBA, NFL y tenis. Puedes predecir jornada a jornada, rellenar el cuadro entero de unas eliminatorias con su pichichi o jugar al superviviente.',
        ],
      },
      {
        heading: 'Bote y reglas',
        paragraphs: [
          'Ninguna de las dos mueve dinero. La Porra calcula cuánto pone cada uno y quién se lleva el bote; en PorrApp el administrador apunta quién ha pagado y el reparto lo decidís vosotros.',
          'En PorrApp el administrador elige cuántos puntos vale cada acierto y, si cambia las reglas a mitad de temporada, los partidos ya jugados se vuelven a puntuar.',
        ],
      },
      {
        heading: 'Cuándo elegir cada una',
        paragraphs: [
          'Elige La Porra si queréis MotoGP o golf, o si os viene bien que la app calcule el bote jornada a jornada.',
          'Elige PorrApp si no queréis límites ni planes de pago, si tenéis varias porras o un grupo grande, o si os gustan los formatos de cuadro, superviviente o UFC. Puedes entrar con Google, con tu email o con una llave de acceso.',
        ],
      },
      {
        heading: 'Cómo pasar tu porra a PorrApp',
        paragraphs: [
          'Crea la liga con la misma competición y las mismas reglas de puntos, y manda el enlace de invitación al grupo. Si estáis a mitad de temporada, empezad desde la próxima jornada.',
        ],
      },
    ],
    faq: [
      {
        question: '¿PorrApp es gratis de verdad?',
        answer:
          'Sí. No hay plan de pago, ni anuncios, ni límite de ligas. PorrApp no mueve dinero: si jugáis con bote, se gestiona fuera de la app.',
      },
      {
        question: '¿Puedo usar las dos a la vez?',
        answer:
          'Claro. Muchos grupos prueban con una jornada antes de cambiar. Las cuentas son independientes.',
      },
    ],
  },
  {
    path: '/mejores-apps-porra',
    navLabel: 'Mejores apps para hacer una porra',
    title: 'Mejores apps para hacer una porra con amigos (2026) · PorrApp',
    description:
      'Las mejores formas de hacer una porra con amigos en 2026: PorrApp, La Porra, Sabios, una hoja de Excel o WhatsApp. Precio, deportes y para quién es cada una.',
    h1: 'Las mejores apps para hacer una porra',
    h1Marked: 'con amigos.',
    lede: 'Hay varias maneras de montar la porra de tu grupo, de una hoja de cálculo a una app hecha para ello. Esta es nuestra comparación. Sí, PorrApp es nuestra, así que contamos también cuándo te conviene otra. Datos consultados el 8 de noviembre de 2026.',
    sections: [
      {
        heading: 'PorrApp',
        paragraphs: [
          'Web gratis, sin planes de pago ni anuncios, y no hay que instalar nada. Fútbol (LaLiga, Champions, Premier, Copa del Rey, Mundial), F1, UFC, NBA, NFL y tenis, con formatos por jornada, cuadro de eliminatorias y superviviente.',
          'Las predicciones se cierran a la hora de cada partido y nadie ve las de los demás hasta entonces. Para grupos que quieren todo gratis y sin límites.',
        ],
      },
      {
        heading: 'La Porra (laporra.app)',
        paragraphs: [
          'Web con muchos deportes, también MotoGP y golf, y una calculadora de bote que dice quién pone cada jornada. Gratis hasta 3 porras a la vez y 100 miembros por porra; el plan Pro cuesta 4,99 € al mes.',
          'Para grupos que siguen MotoGP o golf, o que quieren que la app lleve las cuentas del bote.',
        ],
      },
      {
        heading: 'Sabios (sabiosporra.com)',
        paragraphs: [
          'App para iOS y Android centrada en LaLiga y la Champions, con extras de juego como comodines que duplican puntos y potenciadores. Gratis hasta 5 miembros por liga; los planes PRO (9,99 €) y PLATINUM (14,99 €) se pagan una vez por liga y temporada.',
          'Para peñas pequeñas de fútbol que quieren una app nativa con más elementos de juego.',
        ],
      },
      {
        heading: 'Una hoja de Excel o de Google Sheets',
        paragraphs: [
          'Gratis y a tu medida, pero alguien tiene que apuntar cada resultado y nada impide cambiar una predicción con el partido empezado. Si os va este formato, tenemos una plantilla gratis con los puntos y la clasificación ya calculados.',
        ],
      },
      {
        heading: 'El grupo de WhatsApp',
        paragraphs: [
          'Lo más rápido para una porra de un solo partido: cada uno escribe su resultado y listo. Para una temporada entera se vuelve imposible de llevar.',
        ],
      },
      {
        heading: 'Y los fantasy',
        paragraphs: [
          'Biwenger, Comunio o LaLiga Fantasy son otro juego: fichas jugadores y gestionas una plantilla. Si lo que queréis es predecir resultados, una porra es más sencilla.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Cuál es la mejor app para hacer una porra gratis?',
        answer:
          'Si queréis todo gratis y sin límites, PorrApp. Si os bastan 3 porras y 100 miembros por porra, el plan gratis de La Porra también vale. Sabios es gratis hasta 5 miembros por liga.',
      },
      {
        question: '¿Hace falta instalar algo?',
        answer:
          'Depende de la app. PorrApp y La Porra funcionan en el navegador del móvil, sin instalar nada; Sabios hay que descargarla de Google Play o del App Store.',
      },
    ],
  },
  {
    path: '/porra-oficina',
    navLabel: 'Porra de oficina',
    title: 'Porra de oficina con compañeros de trabajo, gratis · PorrApp',
    description:
      'Monta la porra de la oficina sin Excel ni correos: liga privada para el equipo, predicciones desde el móvil y clasificación automática. Gratis, sin instalar nada.',
    h1: 'La porra de la oficina,',
    h1Marked: 'sin el Excel compartido.',
    lede: 'Cada temporada alguien se encarga de la porra del trabajo: recoge predicciones, apunta resultados y manda la clasificación. Con PorrApp eso se hace solo y tú también juegas.',
    sections: [
      {
        heading: 'Montarla en cinco minutos',
        paragraphs: [
          'Crea una liga privada, elige la competición (LaLiga, la Champions, el Mundial, la F1…) y pega el enlace de invitación en el canal del equipo. Quien ya tenga cuenta puede entrar con el código de la liga.',
          'Se juega desde el navegador del móvil o del ordenador, así que no hay que instalar nada en el ordenador del trabajo. Cada uno entra con Google, con su email o con una llave de acceso: nadie tiene que usar su cuenta personal si no quiere.',
        ],
      },
      {
        heading: 'Sin trabajo para quien la organiza',
        paragraphs: [
          'Los resultados reales llegan solos y los puntos se calculan al terminar cada partido. La clasificación general y la de cada jornada están siempre al día, sin mandar nada por correo.',
          'Cada predicción se cierra a la hora del partido y nadie ve las de los demás hasta entonces, así que no hay discusiones sobre quién cambió qué.',
        ],
      },
      {
        heading: 'Para equipos de cualquier tamaño',
        paragraphs: [
          'No hay límite de jugadores ni de ligas: podéis tener una porra para toda la empresa y otra para cada departamento. El administrador gestiona los miembros y decide cuántos puntos vale cada acierto.',
          'Si jugáis con bote, el administrador apunta quién ha pagado. El dinero se queda fuera de la app: PorrApp no cobra ni reparte nada.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Cuánto cuesta una porra de empresa?',
        answer: 'Nada. PorrApp es gratis para cualquier liga, con los jugadores que queráis.',
      },
      {
        question: '¿Pueden jugar compañeros que no tienen cuenta de Google?',
        answer:
          'Sí. Se pueden registrar con su email y una contraseña, o entrar con una llave de acceso.',
      },
    ],
  },
  {
    path: '/porra-vs-quiniela',
    navLabel: 'Porra o quiniela',
    title: 'Porra o quiniela: diferencias y cuál hacer con amigos · PorrApp',
    description:
      'Qué diferencia hay entre una porra entre amigos y la quiniela oficial: cómo se juega, quién pone las reglas, cuánto cuesta y cuál conviene para tu grupo.',
    h1: 'Porra o quiniela,',
    h1Marked: 'en qué se parecen y en qué no.',
    lede: 'Las dos van de acertar resultados de fútbol, pero son juegos distintos. La quiniela es un juego oficial con boleto y premios; la porra la montáis vosotros, con vuestras reglas.',
    sections: [
      {
        heading: 'La quiniela',
        paragraphs: [
          'Es el juego oficial de Loterías del Estado: cada jornada hay un boleto con 15 partidos de LaLiga y Segunda, marcas 1, X o 2 en los catorce primeros y el resultado exacto en el Pleno al 15.',
          'Cada boleto se paga, los partidos los elige Loterías y los premios dependen de cuánta gente acierta en toda España.',
        ],
      },
      {
        heading: 'La porra',
        paragraphs: [
          'Es un juego entre amigos, compañeros o familia. Vosotros elegís la competición, los partidos y cuántos puntos vale cada acierto: el resultado exacto, el signo o lo que decidáis.',
          'Gana quien más puntos suma en la jornada o en la temporada, y el premio lo pone el grupo: un bote, una cena o simplemente presumir.',
        ],
      },
      {
        heading: 'Cuál conviene',
        paragraphs: [
          'Si queréis jugar a premios oficiales, la quiniela. Si lo que buscáis es pique con vuestro grupo toda la temporada, una porra: es gratis, sirve para cualquier competición y no solo para el fútbol.',
          'En algunos países de Latinoamérica a la porra se la llama también quiniela o prode. Si te referías a eso, estás en el sitio correcto.',
        ],
      },
      {
        heading: 'Una porra sin trabajo',
        paragraphs: [
          'PorrApp lleva la porra por vosotros: carga los partidos, cierra cada predicción a la hora del partido, suma los puntos con los resultados reales y mantiene la clasificación. Si preferís llevarla a mano, tenemos una plantilla gratis en Excel.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Puedo hacer una quiniela con mis amigos en PorrApp?',
        answer:
          'Puedes hacer una porra a 1X2, que es lo más parecido: cada uno elige el signo de cada partido y el administrador decide cuánto vale cada acierto. No es la quiniela oficial ni tiene premios de Loterías.',
      },
      {
        question: '¿La porra cuesta dinero?',
        answer:
          'En PorrApp no. Si vuestro grupo juega con bote, el dinero lo gestionáis vosotros fuera de la app.',
      },
    ],
  },
  {
    path: '/porra-copa-del-rey',
    navLabel: 'Porra de la Copa del Rey',
    title: 'Porra de la Copa del Rey con amigos, ronda a ronda · PorrApp',
    description:
      'Haz una porra de la Copa del Rey con tus amigos: tras cada sorteo elegís quién pasa cada eliminatoria, hasta el campeón. Puntos y clasificación automáticos, gratis.',
    h1: 'La porra de la Copa del Rey,',
    h1Marked: 'eliminatoria a eliminatoria.',
    lede: 'La Copa se juega a eliminatorias y se sortea ronda a ronda. Crea una liga privada, invita a tus amigos y, tras cada sorteo, elegid quién pasa cada cruce hasta la final.',
    screens: {
      title: 'Así se ve una porra de la Copa del Rey',
      shots: [
        appScreen(
          'copa-inicio',
          'Inicio de una liga de la Copa del Rey en PorrApp: los partidos de la primera eliminatoria con su hora.',
        ),
        appScreen(
          'copa-jornada',
          'Primera eliminatoria de la Copa del Rey en PorrApp, con la predicción 1X2 de cada partido.',
        ),
      ],
    },
    sections: [
      {
        heading: 'Cómo se juega',
        paragraphs: [
          'Cuando se sortea una ronda, aparecen sus cruces en tu liga y eliges qué equipo pasa en cada uno. Las predicciones de la ronda se cierran al empezar su primer partido.',
          'En las eliminatorias a ida y vuelta eliges quién pasa la eliminatoria, no cada partido. Así seguís la Copa desde las primeras rondas hasta la final.',
        ],
      },
      {
        heading: 'Puntos y clasificación',
        paragraphs: [
          'Los resultados llegan solos y los puntos se suman cuando se decide cada cruce. Como la Copa es solo eliminatorias, no hay tabla de grupos: cuenta la clasificación de vuestra liga.',
          'El administrador decide cuántos puntos vale cada acierto, y nadie ve las predicciones de los demás hasta que empieza la ronda.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Hay que acertar el resultado de cada partido?',
        answer:
          'No. En la Copa eliges quién pasa cada eliminatoria. Es más sencillo y se sigue bien aunque no veáis todos los partidos.',
      },
    ],
  },
  {
    path: '/apuntar-puntos-juegos-de-mesa',
    navLabel: 'Apuntar puntos de juegos de mesa',
    title: 'Apuntar puntos de juegos de mesa en el móvil, gratis · PorrApp',
    description:
      'Deja el papel y el boli: apunta los puntos de cada ronda en el móvil, mira quién va ganando y guarda el ranking de vuestras partidas de mus, Catán o chinchón.',
    h1: 'Apunta los puntos de la partida,',
    h1Marked: 'sin papel ni boli.',
    lede: 'Una hoja de puntos para las noches de juegos de mesa: cada ronda se apunta desde cualquier móvil, la suma se hace sola y al final queda quién ha ganado, el ranking de la temporada y el histórico de todas las partidas.',
    scoreboardDemo: true,
    sections: [
      {
        heading: 'Una hoja que suma sola',
        paragraphs: [
          'Elige el juego y quién juega, y apunta los puntos de cada ronda. La hoja suma, marca quién va primero y, en juegos como el chinchón, entiende que gana quien menos tiene.',
          'En juegos sin puntos, como el mus o el parchís, basta con tocar quién gana cada partida. Si alguien se equivoca, la ronda se corrige o se borra sin tachones.',
        ],
      },
      {
        heading: 'Todos los móviles ven lo mismo',
        paragraphs: [
          'Cualquiera de la mesa puede apuntar y los demás lo ven en directo en su móvil. Quien no quiera bajarse nada también juega: se le apunta a mano y, si algún día entra, hereda su histórico.',
          'Si en la casa de campo no hay cobertura, las rondas se guardan en el móvil y se envían solas al volver la red.',
        ],
      },
      {
        heading: 'Ranking, fichas y piques',
        paragraphs: [
          'Cada día de juego queda en el histórico con quién vino, a qué se jugó y quién ganó. El ranking por temporada y por juego dice quién gana más al Catán y quién nunca gana al mus.',
          'La ficha de cada jugador cuenta partidas, victorias, rachas y el cara a cara con cada rival, y el resultado de cada partida se comparte como imagen en el grupo.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Cuánto cuesta?',
        answer:
          'Nada. La liga de juegos de mesa es gratis, con los jugadores y partidas que queráis.',
      },
      {
        question: '¿Sirve para cualquier juego de mesa o de cartas?',
        answer:
          'Sí. Hay juegos ya preparados (mus, Catán, chinchón, parchís, Carcassonne, dominó) y cualquier otro se crea poniendo su nombre y qué se cuenta.',
      },
      {
        question: '¿Tienen que tener la app todos los jugadores?',
        answer:
          'No. Basta con que uno apunte. A los demás se les añade a mano y pueden unirse cuando quieran con un enlace.',
      },
    ],
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
  '/restablecer-contrasena': {
    title: 'Nueva contraseña · PorrApp',
    description: HOME_META.description,
  },
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
  '/bracket',
  '/tabla',
  '/prediction',
  '/jornadas',
  '/partida',
  '/historico',
  '/restablecer-contrasena',
];

export const metaForPath = (path: string): PageMeta =>
  CONTENT_PAGES.find((page) => page.path === path) ?? ROUTE_META[path] ?? HOME_META;
