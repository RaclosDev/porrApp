import type { PokerPlanCode } from '../../services/endpoints/poker';

export interface PokerPlanInfo {
  code: PokerPlanCode;
  label: string;
  price: string;
  /** Precio anual o condición, en una línea bajo el precio. */
  note?: string;
  entries: string;
  features: string[];
}

/** Planes del póker. Las porras y los juegos de mesa son gratis y sin límites. */
export const POKER_PLANS: PokerPlanInfo[] = [
  {
    code: 'FREE',
    label: 'Gratis',
    price: '0 €',
    entries: 'Hasta 10 jugadores por torneo',
    features: [
      'Miembros sin límite',
      'Crupier, reloj de ciegas y modo TV',
      'Histórico y estadísticas',
    ],
  },
  {
    code: 'LIGA',
    label: 'Liga',
    price: '4,99 €/mes',
    note: 'o 49 €/año',
    entries: 'Hasta 20 jugadores por torneo',
    features: [
      'Todo lo del plan Gratis',
      'Más sombreros para el crupier (próximamente)',
      'Color del tapete (próximamente)',
    ],
  },
  {
    code: 'CLUB',
    label: 'Club',
    price: 'Bajo consulta',
    entries: 'Hasta 100 jugadores por torneo',
    features: [
      'Todo lo del plan Liga',
      'Escudo de la liga en el tapete y la TV (próximamente)',
      'Inscripción con código QR (próximamente)',
      'Ayuda por mensaje',
    ],
  },
  {
    code: 'CUSTOM',
    label: 'A medida',
    price: 'Bajo consulta',
    entries: 'Sin límite práctico de jugadores',
    features: [
      'Crupier y diseño propios de la liga',
      'Logos del local y de patrocinadores',
      'Varios locales e importación del histórico',
      'Ayuda directa',
    ],
  },
];

export const POKER_PLAN_CONTACT = 'raclosdev@gmail.com';

export function pokerPlan(code: PokerPlanCode | undefined): PokerPlanInfo {
  return POKER_PLANS.find((plan) => plan.code === code) ?? POKER_PLANS[0];
}
