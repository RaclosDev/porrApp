import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraUfc: ContentPage = {
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
};
