import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraF1: ContentPage = {
  path: '/porra-f1',
  navLabel: 'Porra de F1',
  title: 'Porra de F1 con amigos: podio, pole y vuelta rápida · PorrApp',
  description:
    'Monta una porra de F1 con tus amigos: predice el podio, la pole y la vuelta rápida de cada Gran Premio. Puntos y clasificación automáticos, gratis.',
  h1: 'La porra de la F1,',
  h1Marked: 'Gran Premio a Gran Premio.',
  lede: 'Crea una liga privada de Fórmula 1, invita a tus amigos y predice cada carrera del Mundial: quién sube al podio, quién hace la pole y quién marca la vuelta rápida.',
  screens: {
    title: 'Así se ve una porra de la F1',
    shots: [
      appScreen(
        'f1-inicio',
        'Inicio de una liga de Fórmula 1 en PorrApp: el GP de Las Vegas ya predicho, con las fotos de los tres pilotos del podio, y el siguiente por predecir.',
      ),
      appScreen(
        'f1-carreras',
        'Predicción del GP de Las Vegas en PorrApp: se elige el podio piloto a piloto antes de que empiece la clasificación.',
      ),
      appScreen(
        'f1-mundial',
        'Mundial de pilotos de Fórmula 1 dentro de PorrApp, con Kimi Antonelli líder y la diferencia de puntos de cada piloto.',
      ),
    ],
  },
  sections: [
    {
      heading: 'Qué se predice',
      paragraphs: [
        'En cada Gran Premio eliges a los tres pilotos del podio en orden, al que saldrá desde la pole y al de la vuelta rápida. El administrador de la liga decide cuántos puntos vale cada acierto.',
      ],
    },
    {
      heading: 'Resultados y Mundial al día',
      paragraphs: [
        'Cuando termina la carrera llegan la clasificación completa y los puntos de tu liga. También tienes el Mundial de pilotos y el de constructores sin salir de la app.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Qué se predice en la porra de F1?',
      answer:
        'En cada Gran Premio, los tres pilotos del podio en orden, el que hace la pole y el de la vuelta rápida.',
    },
    {
      question: '¿Cómo se reparten los puntos?',
      answer:
        'El administrador de la liga decide cuánto vale cada acierto. Cuando termina la carrera llegan los resultados y la clasificación de la liga se actualiza sola.',
    },
    { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
  ],
};
