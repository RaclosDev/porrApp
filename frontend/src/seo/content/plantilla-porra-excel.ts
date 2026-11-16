import { type ContentPage } from './shared';

export const plantillaPorraExcel: ContentPage = {
  path: '/plantilla-porra-excel',
  navLabel: 'Plantilla de porra en Excel',
  title: 'Plantilla de porra en Excel gratis para tus amigos · PorrApp',
  description:
    'Descarga gratis una plantilla de porra en Excel o Google Sheets: predicciones por partido, puntos automáticos por resultado exacto y por signo, y clasificación.',
  h1: 'Plantilla de porra en Excel,',
  h1Marked: 'gratis.',
  lede: 'Una hoja lista para tu porra de LaLiga, la Champions o el Mundial: apuntas los partidos, cada uno pone su predicción y los puntos y la clasificación se calculan solos.',
  download: {
    href: '/plantillas/plantilla-porra-amigos.xlsx',
    label: 'Descargar la plantilla (.xlsx)',
  },
  sections: [
    {
      heading: 'Qué trae la plantilla',
      paragraphs: [
        'Una pestaña «Porra» con los partidos (jornada, local, visitante y resultado) y tres columnas por jugador: goles del local, goles del visitante y los puntos de ese partido. Caben ocho jugadores y doscientos partidos.',
        'Una pestaña «Puntos» donde decidís cuánto vale acertar el resultado exacto y cuánto acertar el signo (1X2). Por defecto, 3 y 1.',
        'Una pestaña «Clasificación» que suma los puntos de cada jugador y le da su puesto.',
      ],
    },
    {
      heading: 'Cómo se usa',
      paragraphs: [
        'Escribe los nombres de los jugadores en la primera fila y los partidos de la jornada. Antes de cada partido, cada uno rellena su predicción. Cuando acabe, escribe el resultado real: los puntos aparecen solos.',
        'Funciona en Excel, en LibreOffice y en Google Sheets: súbela a Google Drive y ábrela con Hojas de cálculo para compartirla con el grupo.',
      ],
    },
    {
      heading: 'Lo que una hoja de cálculo no hace',
      paragraphs: [
        'Alguien tiene que apuntar cada resultado, y cualquiera con acceso a la hoja puede cambiar su predicción con el partido empezado o ver las de los demás antes de decidir la suya.',
        'PorrApp hace lo mismo sin trabajo: los resultados reales llegan solos, cada predicción se cierra a la hora del partido y nadie ve las de los demás hasta que empieza. Es gratis y no hay que instalar nada.',
      ],
    },
  ],
  faq: [
    {
      question: '¿La plantilla es gratis?',
      answer: 'Sí. Descárgala, cópiala y cámbiala como quieras. No pide registro ni datos.',
    },
    {
      question: '¿Puedo usarla para el Mundial o la Champions?',
      answer:
        'Sí: sirve para cualquier competición de partidos, solo cambia los equipos. Para rellenar el cuadro entero del Mundial, PorrApp tiene un modo de cuadro con eliminatorias y pichichi.',
    },
    {
      question: '¿Y si somos más de ocho?',
      answer:
        'Copia las tres columnas del último jugador a la derecha y añade su fila en «Clasificación». O crea la porra en PorrApp, donde no hay límite de jugadores.',
    },
  ],
};
