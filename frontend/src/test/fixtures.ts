import type { LeagueScoring, Match, ScoringRules, TeamStanding } from '../types/api';

/** Partido con valores neutros; cada test fija solo los campos que le importan. */
export const game = (fields: Partial<Match>): Match => ({
  id: 0,
  home: '',
  away: '',
  home_team_id: null,
  away_team_id: null,
  homeLogo: null,
  awayLogo: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeScore: null,
  awayScore: null,
  home_score: null,
  away_score: null,
  date: null,
  finished: false,
  round: '',
  groupName: null,
  winner: null,
  displayClock: null,
  isStartingSoon: false,
  status: '',
  ...fields,
});

/** Estadísticas de grupo a cero salvo los campos indicados. */
export const standing = (fields: Partial<TeamStanding>): TeamStanding => ({
  pts: 0,
  diff: 0,
  gls: 0,
  mp: 0,
  fp: 0,
  pos: 0,
  status: 0,
  ...fields,
});

/** Reglas por defecto del backend (`ScoringRuleSet.defaultWorldCup2026`). */
export const DEFAULT_SCORING: ScoringRules = {
  groupQualifierPoints: 10,
  groupExactPositionPoints: 10,
  roundOf32Points: 25,
  roundOf16Points: 30,
  quarterFinalPoints: 40,
  semiFinalPoints: 60,
  championPoints: 200,
  runnerUpPoints: 150,
  thirdPlacePoints: 100,
  fourthPlacePoints: 75,
  topScorerPoints: 200,
  exactScorePoints: 5,
  correctSignPoints: 3,
  goalDiffBonusPoints: 1,
};

/** Puntuación de una liga de cuadro completo con las reglas por defecto. */
export const leagueScoring = (fields: Partial<LeagueScoring> = {}): LeagueScoring => ({
  poolFormat: 'FULL_BRACKET',
  pichichi: true,
  editable: true,
  maxPoints: 1000,
  rules: DEFAULT_SCORING,
  defaults: DEFAULT_SCORING,
  ...fields,
});
