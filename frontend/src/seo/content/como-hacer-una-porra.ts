import { HOW_IT_WORKS_FAQ, type ContentPage } from './shared';

export const comoHacerUnaPorra: ContentPage = {
  path: '/como-hacer-una-porra',
  navLabel: 'Cómo hacer una porra',
  title: 'Cómo hacer una porra con amigos, paso a paso · PorrApp',
  description:
    'Guía para hacer una porra: elegir competición, fijar puntos, decidir si hay bote y llevar la clasificación sin errores. Con PorrApp se calcula sola.',
  h1: 'Cómo hacer una porra',
  h1Marked: 'que no acabe en pelea.',
  lede: 'Una porra bien montada necesita unas pocas decisiones al principio: qué se predice, cuántos puntos vale cada acierto y quién lleva las cuentas. Esta guía las repasa en orden.',
  sections: [
    {
      heading: '1. Elige qué se predice',
      paragraphs: [
        'Lo más sencillo es una competición con partidos semanales, como LaLiga o la Champions: cada jornada predecís el resultado de cada partido. Para un torneo corto, como el Mundial, funciona mejor un cuadro completo con el campeón y el pichichi.',
        'En motor o combate se predice el podio de cada Gran Premio o el ganador de cada pelea de la UFC.',
      ],
    },
    {
      heading: '2. Fija los puntos',
      paragraphs: [
        'Decide cuántos puntos da acertar el signo (1X2) y cuántos el marcador exacto. Una regla habitual es 1 punto por el signo y 3 por el resultado exacto: premia el riesgo sin que un acierto de suerte decida la liga.',
        'En PorrApp el administrador de la liga puede cambiar estos valores antes de empezar.',
      ],
    },
    {
      heading: '3. Decide si hay bote',
      paragraphs: [
        'Si jugáis dinero, acordad antes cuánto pone cada uno y cómo se reparte (todo para el primero, o primero y segundo). Apuntad quién ha pagado desde el principio para evitar líos al final.',
        'PorrApp no mueve dinero: el administrador marca quién ha pagado y el bote se gestiona fuera de la app.',
      ],
    },
    {
      heading: '4. Cierra las predicciones a tiempo',
      paragraphs: [
        'La regla que más peleas evita: las predicciones se cierran al empezar cada partido. En PorrApp esto es automático, y a esa hora quedan a la vista de todos.',
      ],
    },
    {
      heading: '5. Deja que la app lleve las cuentas',
      paragraphs: [
        'Recoger predicciones por WhatsApp y puntuar a mano es lo que hace que las porras mueran a mitad de temporada. Con PorrApp los resultados llegan solos y la clasificación general y la de cada jornada siempre están al día.',
      ],
    },
  ],
  faq: HOW_IT_WORKS_FAQ,
};
