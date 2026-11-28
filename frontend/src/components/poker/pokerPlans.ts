import type { PokerPlanCode } from '../../services/endpoints/poker';

interface PokerPlanFeature {
  text: string;
}

export interface PokerPlanInfo {
  code: PokerPlanCode;
  label: string;
  /** Una línea que resume para quién es el plan. */
  tagline: string;
  price: string;
  /** Precio anual o condición, en una línea bajo el precio. */
  note?: string;
  entries: string;
  features: PokerPlanFeature[];
  /** El plan que recomendamos a la mayoría de las ligas. */
  highlight?: boolean;
  /** Ventaja que se enseña junto al precio (ahorro anual, prueba gratis). */
  perk?: string;
  /** Texto del botón para pedirlo. */
  cta?: string;
}

/** Planes del póker. Las porras y los juegos de mesa son gratis y sin límites. */
export const POKER_PLANS: PokerPlanInfo[] = [
  {
    code: 'FREE',
    label: 'Gratis',
    tagline: 'Para empezar con los amigos',
    price: '0 €',
    entries: 'Hasta 10 jugadores por torneo',
    features: [
      { text: 'Miembros sin límite' },
      { text: 'Recompras, add-ons, reloj de ciegas y descansos, todo personalizable' },
      { text: 'Modo TV para seguir el torneo en la pantalla grande' },
      { text: 'Histórico y estadísticas' },
    ],
  },
  {
    code: 'LIGA',
    label: 'Liga',
    tagline: 'Para la timba de cada semana',
    price: '4,99 €/mes',
    note: 'o 49 €/año (4,08 €/mes)',
    perk: 'Ahorra 2 meses pagando el año',
    cta: 'Quiero el plan Liga',
    entries: 'Hasta 20 jugadores por torneo',
    highlight: true,
    features: [
      { text: 'Todo lo del plan Gratis' },
      { text: 'Estilos personalizados para el crupier' },
      { text: 'Tapetes personalizados' },
    ],
  },
  {
    code: 'CLUB',
    label: 'Club',
    tagline: 'Para clubes y torneos con público',
    price: '24,99 €/mes',
    note: 'o 249 €/año (20,75 €/mes)',
    perk: 'Pruébalo gratis: 2 semanas o 2 torneos',
    cta: 'Probar el Club gratis',
    entries: 'Hasta 50 jugadores por torneo',
    features: [
      { text: 'Todo lo del plan Liga' },
      { text: 'Escudo de la liga en el tapete y en la TV' },
      { text: 'Personalización con vuestra marca' },
      { text: 'Inscripción al torneo con código QR' },
      { text: 'Pedidnos funciones para vuestra liga y las desarrollamos' },
      { text: 'Atención personalizada al momento' },
    ],
  },
  {
    code: 'CUSTOM',
    label: 'A medida',
    tagline: 'Para locales y circuitos',
    price: 'Desde 59 €/mes',
    note: 'más la puesta en marcha',
    cta: 'Cuéntanos tu proyecto',
    entries: 'Sin límite práctico de jugadores',
    features: [
      { text: 'Todo lo del plan Club' },
      { text: 'Diseño y crupier propios de la liga' },
      { text: 'Logos del local y de patrocinadores' },
      { text: 'Varios locales e importación del histórico' },
      {
        text: 'Pedidnos funciones para vuestra liga y las desarrollamos: torneos con varias mesas o lo que necesitéis',
      },
      { text: 'Atención directa y prioritaria' },
    ],
  },
];

export const POKER_PLAN_CONTACT = 'raclosdev@gmail.com';

export function pokerPlan(code: PokerPlanCode | undefined): PokerPlanInfo {
  return POKER_PLANS.find((plan) => plan.code === code) ?? POKER_PLANS[0];
}
