import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraChampions: ContentPage = {
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
        'Inicio de una liga de la Champions en PorrApp: las predicciones que te faltan y los partidos de la jornada 5 de la fase de liga.',
      ),
      appScreen(
        'champions-jornada',
        'Jornada 5 de la fase de liga de la Champions en PorrApp: Bodo/Glimt-LASK y los demás partidos abiertos, con los botones 1, X y 2.',
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
};
