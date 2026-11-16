import { type ContentPage } from './shared';

export const instalarAppMovil: ContentPage = {
  path: '/instalar-app-movil',
  navLabel: 'Instalar la app',
  title: 'Instalar PorrApp en el móvil como una app (Android y iPhone)',
  description:
    'PorrApp se instala en la pantalla de inicio de tu móvil como una app, sin tienda: pasos para Android (Chrome) y iPhone (Safari). Gratis y se actualiza sola.',
  h1: 'PorrApp en tu móvil,',
  h1Marked: 'como una app más.',
  lede: 'No hace falta buscarla en Google Play ni en la App Store. PorrApp es una app web (PWA): la abres en el navegador, la añades a la pantalla de inicio y funciona como cualquier otra aplicación.',
  sections: [
    {
      heading: 'Qué es una PWA',
      paragraphs: [
        'Una PWA es una web que se puede instalar. Tiene su icono en el móvil, se abre a pantalla completa, sin barra del navegador, y se actualiza sola cada vez que mejoramos algo. No hay descargas pesadas ni actualizaciones que aceptar.',
        'Es la misma PorrApp de siempre: tus ligas, tus predicciones y tu clasificación. Lo único que cambia es que la tienes a un toque desde la pantalla de inicio.',
      ],
    },
    {
      heading: 'Instalarla en Android (Chrome)',
      paragraphs: [
        'Abre porrapp.app en Chrome. Pulsa el menú de los tres puntos y elige «Instalar aplicación» o «Añadir a la pantalla de inicio». Confirma y aparecerá el icono de PorrApp junto al resto de tus apps.',
      ],
    },
    {
      heading: 'Instalarla en iPhone (Safari)',
      paragraphs: [
        'Abre porrapp.app en Safari. Pulsa el botón de compartir (el cuadrado con la flecha hacia arriba), baja y elige «Añadir a pantalla de inicio». Pulsa «Añadir» y ya tienes el icono de PorrApp en el iPhone.',
        'En iPhone tiene que ser desde Safari: otros navegadores no siempre ofrecen esa opción.',
      ],
    },
    {
      heading: 'Y en el ordenador',
      paragraphs: [
        'En Chrome o Edge aparece un icono de instalar en la barra de direcciones. También puedes usar PorrApp simplemente desde el navegador, sin instalar nada.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Hay PorrApp en Google Play o en la App Store?',
      answer:
        'No hace falta: se instala directamente desde el navegador, con el mismo resultado que una app de la tienda y sin cuenta de Google ni de Apple.',
    },
    {
      question: '¿Ocupa mucho espacio en el móvil?',
      answer: 'Muy poco, mucho menos que una app descargada de la tienda. Y se actualiza sola.',
    },
    {
      question: '¿Tengo que instalarla para jugar?',
      answer:
        'No. Funciona igual desde el navegador. Instalarla solo te da el icono y la pantalla completa.',
    },
  ],
};
