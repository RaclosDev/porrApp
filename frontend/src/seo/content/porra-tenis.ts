import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraTenis: ContentPage = {
  path: '/porra-tenis',
  navLabel: 'Porra de tenis',
  title: 'Porra de tenis con amigos, Grand Slams y Masters · PorrApp',
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
        'Inicio de una liga de tenis en PorrApp: la fase de grupos de las ATP Finals, con el resultado en sets de cada partido.',
      ),
      appScreen(
        'tenis-jornada',
        'Fase de grupos de las ATP Finals en PorrApp: en Zverev-Shelton se elige quién gana y, si quieres, los sets.',
      ),
      appScreen(
        'tenis-cuadro',
        'Cuadro del Masters de París en PorrApp: octavos de final con el resultado en sets de cada partido.',
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
};
