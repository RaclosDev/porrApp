import { FREE_ANSWER, type ContentPage } from './shared';

export const porraEntreAmigos: ContentPage = {
  path: '/porra-entre-amigos',
  navLabel: 'Porra entre amigos',
  title: 'Porra entre amigos gratis: crea la tuya en un minuto · PorrApp',
  description:
    'Monta una porra entre amigos de fútbol, F1, UFC, NBA o tenis. Liga privada, invitación por enlace y clasificación automática. Gratis, sin descargas ni anuncios.',
  h1: 'Una porra entre amigos,',
  h1Marked: 'sin hojas de cálculo.',
  lede: 'Crea una liga privada, pasa el enlace por el grupo de WhatsApp y cada uno hace sus predicciones desde el móvil. Los puntos y la clasificación se calculan solos con los resultados reales.',
  sections: [
    {
      heading: 'Para qué sirve una porra entre amigos',
      paragraphs: [
        'Una porra entre amigos es un pique sano: todos predecís los mismos partidos, carreras o combates y gana quien más acierta. PorrApp lleva la cuenta por vosotros, así que nadie tiene que apuntar resultados ni repasar quién ha fallado qué.',
        'Funciona con LaLiga, la Champions, la Premier, el Mundial, la Copa del Rey, la Fórmula 1, la UFC, la NBA, la NFL y el tenis. Podéis tener varias ligas a la vez, cada una con su propia clasificación.',
      ],
    },
    {
      heading: 'Cómo empezar',
      paragraphs: [
        'Entra con Google o con tu email, crea la liga y elige la competición. Comparte el enlace de invitación y, al abrirlo, cada amigo queda unido a la liga.',
        'Las predicciones se cierran a la hora de cada partido y, desde entonces, todos ven lo que eligió cada uno. Sin discusiones sobre quién cambió su resultado.',
      ],
    },
    {
      heading: 'Gratis y sin complicaciones',
      paragraphs: [
        'No hay que instalar nada: PorrApp funciona en el navegador del móvil o del ordenador. Es gratis, sin anuncios y sin límite de amigos ni de ligas.',
        'Si jugáis con bote, el administrador apunta quién ha pagado. El dinero se queda fuera de la app: PorrApp no cobra ni reparte nada.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Cuánto cuesta una porra entre amigos en PorrApp?',
      answer: FREE_ANSWER,
    },
    {
      question: '¿Cuántos amigos pueden jugar?',
      answer: 'Los que queráis. No hay límite de jugadores por liga ni de ligas por cuenta.',
    },
    {
      question: '¿Tienen que registrarse mis amigos?',
      answer:
        'Basta con que abran el enlace de invitación y entren con Google o con su email. Les lleva unos segundos.',
    },
  ],
};
