import { type ContentPage } from './shared';

export const porraOficina: ContentPage = {
  path: '/porra-oficina',
  navLabel: 'Porra de oficina',
  title: 'Porra de oficina con compañeros de trabajo, gratis · PorrApp',
  description:
    'Monta la porra de la oficina sin Excel ni correos: liga privada para el equipo, predicciones desde el móvil y clasificación automática. Gratis, sin instalar nada.',
  h1: 'La porra de la oficina,',
  h1Marked: 'sin el Excel compartido.',
  lede: 'Cada temporada alguien se encarga de la porra del trabajo: recoge predicciones, apunta resultados y manda la clasificación. Con PorrApp eso se hace solo y tú también juegas.',
  sections: [
    {
      heading: 'Montarla en cinco minutos',
      paragraphs: [
        'Crea una liga privada, elige la competición (LaLiga, la Champions, el Mundial, la F1…) y pega el enlace de invitación en el canal del equipo. Quien ya tenga cuenta puede entrar con el código de la liga.',
        'Se juega desde el navegador del móvil o del ordenador, así que no hay que instalar nada en el ordenador del trabajo. Cada uno entra con Google, con su email o con una llave de acceso: nadie tiene que usar su cuenta personal si no quiere.',
      ],
    },
    {
      heading: 'Sin trabajo para quien la organiza',
      paragraphs: [
        'Los resultados reales llegan solos y los puntos se calculan al terminar cada partido. La clasificación general y la de cada jornada están siempre al día, sin mandar nada por correo.',
        'Cada predicción se cierra a la hora del partido y nadie ve las de los demás hasta entonces, así que no hay discusiones sobre quién cambió qué.',
      ],
    },
    {
      heading: 'Para equipos de cualquier tamaño',
      paragraphs: [
        'No hay límite de jugadores ni de ligas: podéis tener una porra para toda la empresa y otra para cada departamento. El administrador gestiona los miembros y decide cuántos puntos vale cada acierto.',
        'Si jugáis con bote, el administrador apunta quién ha pagado. El dinero se queda fuera de la app: PorrApp no cobra ni reparte nada.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Cuánto cuesta una porra de empresa?',
      answer: 'Nada. PorrApp es gratis para cualquier liga, con los jugadores que queráis.',
    },
    {
      question: '¿Pueden jugar compañeros que no tienen cuenta de Google?',
      answer:
        'Sí. Se pueden registrar con su email y una contraseña, o entrar con una llave de acceso.',
    },
  ],
};
