import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraNba: ContentPage = {
  path: '/porra-nba',
  navLabel: 'Porra de la NBA',
  title: 'Porra de la NBA con amigos, temporada y playoffs · PorrApp',
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
        'Inicio de una liga de la NBA en PorrApp: resultados de la semana 5, como el Heat 128-110 Rockets, con el escudo de cada equipo.',
      ),
      appScreen(
        'nba-jornada',
        'Semana 5 de la NBA en PorrApp: en cada partido, como Raptors-Knicks, se elige qué equipo gana.',
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
};
