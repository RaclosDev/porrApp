import { appScreen, type ContentPage } from './shared';

export const porraCopaDelRey: ContentPage = {
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
};
