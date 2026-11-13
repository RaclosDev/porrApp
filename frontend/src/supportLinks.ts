/**
 * Formas de apoyar el proyecto. Son enlaces externos normales: sin scripts ni imágenes de
 * terceros, para que la página no avise a nadie de cada visita. Los colores imitan los botones de
 * cada plataforma para que se reconozcan de un vistazo, con contraste suficiente para leerlos.
 */
export const SUPPORT_LINKS = [
  {
    label: 'Revolut',
    href: 'https://revolut.me/raclos',
    hint: 'Tarjeta o Apple Pay, sin app',
    background: '#191c1f',
    color: '#ffffff',
  },
  {
    label: 'PayPal',
    href: 'https://www.paypal.com/paypalme/raclos',
    hint: 'Con tu cuenta de PayPal',
    background: '#ffc439',
    color: '#003087',
  },
  {
    label: 'Ko-fi',
    href: 'https://ko-fi.com/O3E42AJYOP',
    hint: 'PayPal + mensaje de ánimo',
    background: '#13c3ff',
    color: '#0b1b2b',
  },
] as const;
