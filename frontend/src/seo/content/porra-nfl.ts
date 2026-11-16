import { appScreen, FREE_ANSWER, type ContentPage } from './shared';

export const porraNfl: ContentPage = {
  path: '/porra-nfl',
  navLabel: 'Porra de la NFL',
  title: 'Porra de la NFL con amigos, semana a semana · PorrApp',
  description:
    'Monta una porra de la NFL con tus amigos: predice el ganador de cada partido de la semana o juega al superviviente. Clasificación automática y gratis.',
  h1: 'La porra de la NFL,',
  h1Marked: 'semana a semana.',
  lede: 'Crea una liga privada de la NFL, invita a tus amigos y predice quién gana cada partido de la semana, del jueves al lunes por la noche.',
  screens: {
    title: 'Así se ve una porra de la NFL',
    shots: [
      appScreen(
        'nfl-inicio',
        'Inicio de una liga de la NFL en PorrApp: resultados de la semana 9, como el Ravens 10-33 Jaguars.',
      ),
      appScreen(
        'nfl-jornada',
        'Semana 9 de la NFL en PorrApp: en cada partido, como Chargers-Texans, se elige qué equipo gana.',
      ),
      appScreen(
        'nfl-tabla',
        'Clasificación de la NFL por divisiones dentro de PorrApp, con victorias, derrotas y puesto de playoffs.',
      ),
    ],
  },
  sections: [
    {
      heading: 'Cada semana, sus partidos',
      paragraphs: [
        'Los partidos llegan con sus horarios reales y se cierran a su hora. La app te dice qué equipos descansan esa semana.',
        'Tienes la clasificación de la NFL por división y por conferencia, con el balance de cada equipo y los puestos de playoffs.',
      ],
    },
    {
      heading: 'Modo superviviente',
      paragraphs: [
        'Cada semana eliges un equipo que creas que va a ganar, sin repetir. Si pierde, pierdes una vida; el administrador decide cuántas tiene cada uno. El último en pie gana la liga.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Qué se predice en la porra de la NFL?',
      answer:
        'Quién gana cada partido de la semana, del jueves al lunes por la noche. Cada partido se cierra a su hora.',
    },
    {
      question: '¿Cómo funciona el modo superviviente?',
      answer:
        'Cada semana eliges un equipo que creas que va a ganar, sin repetir. Si pierde, pierdes una vida; el administrador decide cuántas tiene cada uno. El último en pie gana.',
    },
    { question: '¿Cuánto cuesta?', answer: FREE_ANSWER },
  ],
};
