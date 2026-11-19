import { type ContentPage } from './shared';

export const porraVsQuiniela: ContentPage = {
  path: '/porra-vs-quiniela',
  navLabel: 'Porra o quiniela',
  title: '¿Porra o quiniela? Diferencias y cuál elegir · PorrApp',
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
};
