export const pokerRoutes = {
  table: { to: '/poker/mesa', label: 'Mesa' },
  history: { to: '/poker/historico', label: 'Histórico' },
  statistics: { to: '/poker/estadisticas', label: 'Estadísticas' },
} as const;

export type PokerSection = keyof typeof pokerRoutes;
