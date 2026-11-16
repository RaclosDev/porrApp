import { HOW_IT_WORKS_FAQ, type ContentPage } from './shared';

export const comoFunciona: ContentPage = {
  path: '/como-funciona',
  navLabel: 'Cómo funciona',
  title: 'Cómo hacer una porra de fútbol con amigos · PorrApp',
  description:
    'Así funciona PorrApp: creas una liga, invitas a tus amigos con un enlace, cada uno hace sus predicciones y los puntos se calculan solos con los resultados reales.',
  h1: 'Cómo montar una porra',
  h1Marked: 'con tus amigos.',
  lede: 'Una porra de fútbol de las de siempre, sin hojas de cálculo ni cuentas a mano: cada uno hace sus predicciones desde el móvil y la clasificación se actualiza sola.',
  sections: [
    {
      heading: 'Crea la liga',
      paragraphs: [
        'Entra con Google o con tu email y crea una liga privada. Eliges la competición (LaLiga, la Premier, la Champions y otras) y el formato: predicciones jornada a jornada o el cuadro de unas eliminatorias.',
        'Quien crea la liga es su administrador: puede cambiar los puntos de cada acierto, gestionar a los miembros y apuntar quién ha pagado si jugáis con bote.',
      ],
    },
    {
      heading: 'Invita a tus amigos',
      paragraphs: [
        'Comparte el enlace de invitación por WhatsApp o por donde soléis hablar. Al abrirlo, cada uno entra con Google o con su email y queda unido a la liga.',
        'Si alguien ya tiene cuenta en PorrApp, le basta el código de invitación: lo escribe en «Unirse con código», desde el selector de liga o desde Mis ligas.',
      ],
    },
    {
      heading: 'Haz tus predicciones',
      paragraphs: [
        'En las ligas por jornadas predices cada partido: el signo (1X2) o el marcador exacto, según elija la liga. Puedes cambiarlo hasta que empieza: a esa hora se cierra solo y tu predicción queda a la vista del resto.',
        'En el cuadro del Mundial ordenas los grupos, rellenas las eliminatorias hasta el campeón y eliges al pichichi antes de que empiece el torneo.',
      ],
    },
    {
      heading: 'Sigue la clasificación',
      paragraphs: [
        'Los puntos llegan solos con los resultados reales. Tienes la clasificación general de la liga, la de cada jornada y, en cada partido, qué eligió cada uno y cuántos acertaron.',
      ],
    },
  ],
  faq: HOW_IT_WORKS_FAQ,
};
