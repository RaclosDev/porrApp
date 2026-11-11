import type { TrackerGameDraft } from '../../services/endpoints/trackers';

export const GAME_TEMPLATES: TrackerGameDraft[] = [
  { name: 'Mus', unit: 'rondas', lowerWins: false, mode: 'WINS' },
  { name: 'Catán', unit: 'puntos de victoria', lowerWins: false, mode: 'POINTS' },
  { name: 'Chinchón', unit: 'puntos', lowerWins: true, mode: 'POINTS' },
  { name: 'Parchís', unit: 'victorias', lowerWins: false, mode: 'DIRECT' },
  { name: 'Polilla tramposa', unit: 'victorias', lowerWins: false, mode: 'DIRECT' },
  { name: 'Carcassonne', unit: 'puntos', lowerWins: false, mode: 'POINTS' },
  { name: 'Dominó', unit: 'puntos', lowerWins: false, mode: 'POINTS' },
];
