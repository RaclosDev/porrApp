/**
 * Zonas de la tabla de una competición de fútbol: quién pasa, quién juega la eliminatoria previa y quién
 * cae. Solo las que fija el reglamento, no las que cambian cada año (las plazas europeas extra).
 */
type ZoneTone = 'top' | 'middle' | 'bottom';

export interface StandingsZone {
  /** Primer y último puesto de la zona; un puesto negativo cuenta desde el final (-3: antepenúltimo). */
  from: number;
  to: number;
  label: string;
  tone: ZoneTone;
}

/** Fase de liga de la Champions, la Europa League y la Conference: 36 equipos. */
const UEFA_LEAGUE_PHASE: StandingsZone[] = [
  { from: 1, to: 8, label: 'Octavos de final', tone: 'top' },
  { from: 9, to: 24, label: 'Playoff de octavos', tone: 'middle' },
  { from: 25, to: 36, label: 'Eliminado', tone: 'bottom' },
];

/** Liga de 20 equipos con cuatro plazas fijas de Champions y tres descensos. */
const TOP_FOUR_THREE_DOWN: StandingsZone[] = [
  { from: 1, to: 4, label: 'Champions League', tone: 'top' },
  { from: -3, to: -1, label: 'Descenso', tone: 'bottom' },
];

/** Liga de 18 equipos con promoción de permanencia (el antepenúltimo) y dos descensos. */
const PLAYOFF_TWO_DOWN: StandingsZone[] = [
  { from: -3, to: -3, label: 'Promoción de descenso', tone: 'middle' },
  { from: -2, to: -1, label: 'Descenso', tone: 'bottom' },
];

const ZONES: Record<string, StandingsZone[]> = {
  'uefa.champions': UEFA_LEAGUE_PHASE,
  'uefa.europa': UEFA_LEAGUE_PHASE,
  'uefa.europa.conf': UEFA_LEAGUE_PHASE,
  'esp.1': TOP_FOUR_THREE_DOWN,
  'eng.1': TOP_FOUR_THREE_DOWN,
  'ita.1': TOP_FOUR_THREE_DOWN,
  'ger.1': [{ from: 1, to: 4, label: 'Champions League', tone: 'top' }, ...PLAYOFF_TWO_DOWN],
  'fra.1': [
    { from: 1, to: 3, label: 'Champions League', tone: 'top' },
    { from: 4, to: 4, label: 'Previa de Champions', tone: 'middle' },
    ...PLAYOFF_TWO_DOWN,
  ],
};

/** Zonas de la tabla de una competición; vacías si no tiene o no se conocen. */
export const standingsZones = (externalId: string | null | undefined): StandingsZone[] =>
  (externalId && ZONES[externalId]) || [];

/** Zona de un puesto en una tabla de `size` equipos, o null. */
export function zoneOf(zones: StandingsZone[], rank: number, size: number): StandingsZone | null {
  const position = (value: number) => (value < 0 ? size + 1 + value : value);
  return zones.find((zone) => rank >= position(zone.from) && rank <= position(zone.to)) ?? null;
}
