import { appScreen, type ContentPage } from './shared';

export const timbasDePoker: ContentPage = {
  path: '/timbas-de-poker',
  navLabel: 'Organizar timbas de póker',
  title: 'Organizar timbas de póker con amigos, gratis · PorrApp',
  description:
    'Reloj de ciegas, recompras, add-ons, bote y reparto de premios en el móvil. Lleva las timbas de póker con amigos y guarda el ranking y las estadísticas.',
  h1: 'Organiza la timba de póker',
  h1Marked: 'desde el móvil.',
  demoLeague: 'poker',
  lede: 'Todo lo que hace falta en una partida de póker en casa: el reloj de ciegas, quién ha recomprado, cuánto hay en el bote y cuánto cobra cada puesto. Al terminar queda el histórico de la timba y el ranking de la temporada.',
  screens: {
    title: 'Así se ve una timba de póker en PorrApp',
    shots: [
      appScreen(
        'poker-mesa',
        'Torneo de póker en juego en PorrApp: reloj del nivel 3 con las ciegas y los jugadores en mesa a los lados del crupier, caras de los jugadores, media de fichas y bote.',
      ),
      appScreen(
        'poker-historico',
        'Histórico de torneos de póker en PorrApp: podio con los tres primeros, premios, puntos y neto de cada jugador.',
      ),
      appScreen(
        'poker-estadisticas',
        'Estadísticas de una liga de póker en PorrApp: podio de la liga y puntos, victorias y torneos jugados de cada jugador.',
      ),
    ],
  },
  sections: [
    {
      heading: 'Reloj de ciegas que no se para',
      paragraphs: [
        'Prepara la estructura de ciegas con sus niveles, antes y descansos. El reloj marca el tiempo de cada nivel, pasa solo al siguiente y sigue en hora aunque se bloquee el móvil.',
        'Cualquiera de la mesa lo ve en su móvil, y el anfitrión puede pausarlo o adelantar el nivel si hace falta.',
      ],
    },
    {
      heading: 'Recompras, add-ons y bote',
      paragraphs: [
        'Apunta la entrada, las recompras y los add-ons de cada jugador con un toque. Las recompras pueden ser limitadas o sin límite, y el bote se suma solo.',
        'Si alguien cae, se marca como eliminado; si vuelve con una recompra o fue un error, se recupera sin rehacer nada.',
      ],
    },
    {
      heading: 'Reparto de premios sin discusiones',
      paragraphs: [
        'Decide qué porcentaje del bote se lleva cada puesto y cámbialo durante la partida si cambia el número de jugadores. La app calcula cuánto cobra cada uno, sin perder céntimos y con los empates bien repartidos.',
        'Si la timba se cierra antes de tiempo, basta con apuntar las fichas de cada jugador que queda y el reparto se hace por fichas.',
      ],
    },
    {
      heading: 'Histórico, ranking y estadísticas',
      paragraphs: [
        'Cada timba queda guardada con quién jugó, cuánto hubo en el bote y quién se llevó qué. Las estadísticas de la liga cuentan torneos, victorias, podios, premios, recompras y el neto de cada jugador.',
        'Y para los piques, los iconos dejan claro quién ganó la última timba y quién recompra siempre, y los aplausos recuerdan quién se quedó a las puertas del premio.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Cuánto cuesta?',
      answer: 'Nada. La liga de póker es gratis, con los jugadores y timbas que queráis.',
    },
    {
      question: '¿PorrApp mueve el dinero de la timba?',
      answer:
        'No. La app solo lleva la cuenta del bote y de los premios. El dinero, si lo hay, lo gestionáis vosotros en la mesa.',
    },
    {
      question: '¿Tienen que tener la app todos los jugadores?',
      answer:
        'No. Basta con que el anfitrión lleve la partida. A los demás se les añade a mano y pueden unirse con un enlace para ver el reloj y sus estadísticas.',
    },
    {
      question: "¿Sirve para torneos de Texas Hold'em y otras variantes?",
      answer:
        "Sí. El reloj de ciegas, las recompras y el reparto de premios valen para cualquier torneo de fichas: Texas Hold'em, Omaha o la variante que juguéis en casa.",
    },
  ],
};
