import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraLaliga: ContentPage = {
  path: '/porra-laliga',
  navLabel: 'Porra de LaLiga',
  title: 'Porra de LaLiga con amigos, gratis · PorrApp',
  description:
    'Monta una porra de LaLiga con tus amigos: predicciones de cada jornada, cierre automático al empezar cada partido y clasificación al día. Gratis.',
  h1: 'Tu porra de LaLiga,',
  h1Marked: 'jornada a jornada.',
  lede: 'Crea una liga privada para la temporada de LaLiga, invita a tus amigos y predice cada partido, a 1X2 o a marcador exacto. Los puntos se suman solos cuando termina.',
  screens: {
    title: 'Así se ve una porra de LaLiga',
    shots: [
      appScreen(
        'laliga-inicio',
        'Inicio de una liga de LaLiga en PorrApp: los partidos de la jornada 13, como el Athletic Club-Espanyol, con el escudo de cada equipo.',
      ),
      appScreen(
        'laliga-jornada',
        'Jornada 13 de LaLiga en PorrApp: Athletic Club-Espanyol y los demás partidos abiertos, con los botones 1, X y 2.',
      ),
      appScreen(
        'laliga-tabla',
        'Clasificación de LaLiga dentro de PorrApp, con Barcelona y Real Madrid arriba y los puntos de cada equipo.',
      ),
    ],
  },
  sections: [
    {
      heading: 'Toda la temporada',
      paragraphs: [
        'PorrApp carga el calendario de LaLiga EA Sports con fechas y horarios reales. Cada jornada aparece en tu liga con sus partidos, y los resultados llegan en directo.',
        'No hace falta que nadie apunte resultados ni sume puntos: la clasificación de la liga y la de cada jornada se actualizan solas.',
      ],
    },
    {
      heading: 'Sin trampas',
      paragraphs: [
        'Cada partido se cierra a su hora de inicio, así que puedes dejar tu predicción del domingo para el domingo. Hasta que empieza, nadie ve lo que has elegido.',
        'Cuando el partido arranca, todas las predicciones quedan a la vista: quién fue con el local, quién se arriesgó con el empate y cuántos acertaron.',
      ],
    },
    {
      heading: 'A vuestra manera',
      paragraphs: [
        'El administrador decide cuántos puntos vale cada acierto. Si jugáis con bote, puede apuntar quién ha pagado; el dinero se queda fuera de la app.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Cómo se hace una porra de LaLiga con amigos?',
      answer:
        'Creas una liga privada de LaLiga, mandas el enlace de invitación por WhatsApp y cada uno hace sus predicciones de la jornada desde el móvil. Los resultados reales y los puntos llegan solos.',
    },
    {
      question: '¿Se predice el 1X2 o el resultado exacto?',
      answer:
        'Lo elige la liga: el signo de cada partido (1X2) o el marcador exacto. El administrador decide además cuántos puntos vale cada acierto.',
    },
    { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
  ],
};
