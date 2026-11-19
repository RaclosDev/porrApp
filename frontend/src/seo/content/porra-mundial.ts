import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraMundial: ContentPage = {
  path: '/porra-mundial',
  navLabel: 'Porra del Mundial',
  title: 'Porra del Mundial con cuadro y pichichi · PorrApp',
  description:
    'La porra del Mundial en PorrApp: ordenas los grupos, rellenas las eliminatorias hasta el campeón y eliges al pichichi. Mira cómo quedó el Mundial 2026.',
  h1: 'La porra del Mundial,',
  h1Marked: 'con cuadro completo.',
  lede: 'En el Mundial no se predice partido a partido: se rellena el cuadro entero antes de que empiece, de la fase de grupos a la final, y se elige al máximo goleador.',
  screens: {
    title: 'Así se ve una porra del Mundial',
    shots: [
      appScreen(
        'mundial-inicio',
        'Inicio de una porra del Mundial 2026 ya terminada en PorrApp: el podio de la liga con los puntos de cada participante.',
      ),
      appScreen(
        'mundial-resultados',
        'Cuadro del Mundial 2026 en PorrApp: las semifinales Francia-España e Inglaterra-Argentina, con quién se clasifica y quién cae.',
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
};
