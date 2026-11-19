import { type ContentPage } from './shared';

export const apuntarPuntosJuegosDeMesa: ContentPage = {
  path: '/apuntar-puntos-juegos-de-mesa',
  navLabel: 'Apuntar puntos de juegos de mesa',
  title: 'Apuntar puntos de juegos de mesa en el móvil · PorrApp',
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
};
