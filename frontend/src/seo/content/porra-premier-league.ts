import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraPremierLeague: ContentPage = {
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
        'Inicio de una liga de la Premier League en PorrApp: los partidos de la jornada 11, como el Manchester City-Fulham.',
      ),
      appScreen(
        'premier-jornada',
        'Jornada 11 de la Premier League en PorrApp: Manchester City-Fulham y los demás partidos abiertos, con los botones 1, X y 2.',
      ),
      appScreen(
        'premier-tabla',
        'Clasificación de la Premier League dentro de PorrApp, con el Arsenal líder y los puntos de cada equipo.',
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
};
