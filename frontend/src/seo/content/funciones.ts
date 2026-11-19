import { type ContentPage } from './shared';

/**
 * Ficha completa de lo que hace PorrApp. Lo que solo se ve dentro de una liga (reglas de puntos,
 * pichichi, avisos, PWA) no lo conocen ni Google ni los asistentes de IA si no está en una página
 * pública, así que aquí va todo junto y con las palabras con que lo busca la gente.
 */
export const funciones: ContentPage = {
  path: '/funciones',
  navLabel: 'Funciones',
  title: 'Todas las funciones de PorrApp para tu porra',
  description:
    'Puntos configurables por el administrador, resultado exacto, diferencia de goles, pichichi, cuadro, superviviente, avisos en el móvil y app instalable. Gratis.',
  h1: 'Todo lo que puede hacer',
  h1Marked: 'tu porra en PorrApp.',
  lede: 'PorrApp es una app web gratuita y sin anuncios para hacer porras entre amigos de fútbol, F1, UFC, NBA, NFL y tenis. Estas son todas sus funciones, también las que solo se ven al crear una liga.',
  sections: [
    {
      heading: 'Puntos configurables por el administrador',
      paragraphs: [
        'Cada liga tiene su propio baremo. El administrador decide cuántos puntos vale cada acierto: el resultado exacto, el signo (1X2), el plus por acertar la diferencia de goles, cada equipo que pasa de grupo, cada ronda del cuadro, el campeón, el subcampeón, el tercero y el cuarto, y el pichichi.',
        'Si no quiere pensar, la liga arranca con un baremo por defecto que ya funciona: 5 puntos por resultado exacto, 3 por el signo y 1 extra por la diferencia de goles.',
      ],
    },
    {
      heading: 'Pichichi y predicciones de torneo',
      paragraphs: [
        'En torneos como el Mundial o la Champions cada jugador puede elegir al máximo goleador (pichichi) y al campeón, además de ordenar los grupos y rellenar el cuadro de eliminatorias entero.',
      ],
    },
    {
      heading: 'Formatos de porra',
      paragraphs: [
        'Jornada a jornada: predices el resultado de cada partido. Cuadro completo: grupos y eliminatorias hasta la final. Solo eliminatorias: eliges quién pasa cada ronda, como en la Copa del Rey. Superviviente: un equipo ganador por jornada, sin repetir, con las vidas que decida el administrador. Gran premio: podio, pole y vuelta rápida en la F1.',
        'En la UFC se predice ganador, método y asalto de cada combate; en la NBA, las series de playoffs; en el tenis, los Grand Slams y los Masters 1000.',
      ],
    },
    {
      heading: 'Cierre de predicciones a tu manera',
      paragraphs: [
        'Las predicciones se cierran solas para que nadie haga trampa: partido a partido, al empezar cada jornada o cada día, al empezar el primer partido o en una fecha fija. Nadie ve lo que han puesto los demás hasta que se cierra.',
      ],
    },
    {
      heading: 'Clasificación y resultados automáticos',
      paragraphs: [
        'Los resultados reales llegan solos y PorrApp calcula los puntos y la clasificación sin que nadie tenga que apuntar nada. Se puede ver la clasificación general y la de cada jornada.',
      ],
    },
    {
      heading: 'Avisos en el móvil',
      paragraphs: [
        'Con las notificaciones activadas, PorrApp te avisa si un partido está a punto de empezar y no has hecho tu predicción, si te falta elegir equipo en el superviviente y cuando termina la jornada.',
      ],
    },
    {
      heading: 'App instalable sin tienda',
      paragraphs: [
        'PorrApp es una PWA: funciona en el navegador y se instala en la pantalla de inicio de Android o iPhone como una app más, sin pasar por Google Play ni la App Store y sin descargas pesadas.',
      ],
    },
    {
      heading: 'Ligas privadas con invitación',
      paragraphs: [
        'Cada liga es privada: entras con el enlace de invitación que te pasan por WhatsApp. Puedes tener varias ligas a la vez, sin límite de jugadores. Se entra con Google, con email o con una llave de acceso.',
        'Si jugáis con bote, el administrador puede apuntar quién ha pagado. PorrApp no mueve dinero: el bote se gestiona fuera de la app.',
      ],
    },
    {
      heading: 'Gratis y sin anuncios',
      paragraphs: [
        'Todo lo anterior es gratis, sin planes de pago y sin publicidad. También hay herramientas para apuntar puntos de juegos de mesa y organizar timbas de póker con amigos.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Se puede cambiar cuántos puntos vale cada acierto?',
      answer:
        'Sí. El administrador de la liga ajusta los puntos del resultado exacto, el signo, la diferencia de goles, cada ronda del cuadro, el campeón y el pichichi.',
    },
    {
      question: '¿Se puede elegir pichichi?',
      answer:
        'Sí, en los torneos con cuadro, como el Mundial o la Champions, cada jugador elige al máximo goleador y suma los puntos que haya fijado el administrador.',
    },
    {
      question: '¿PorrApp tiene app para el móvil?',
      answer:
        'Sí, se instala desde el navegador como una PWA en Android y iPhone, sin pasar por la tienda, y puede mandarte avisos de los partidos que te faltan por predecir.',
    },
    {
      question: '¿Cuánto cuesta?',
      answer: 'Nada. PorrApp es gratis, sin planes de pago y sin anuncios.',
    },
  ],
};
