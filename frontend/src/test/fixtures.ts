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

/** Reglas por defecto del backend (`ScoringRuleSet.defaults`). */
export const DEFAULT_SCORING: ScoringRules = {
  groupQualifierPoints: 5,
  groupExactPositionPoints: 5,
  roundOf32Points: 10,
  roundOf16Points: 15,
  quarterFinalPoints: 20,
  semiFinalPoints: 30,
  championPoints: 50,
  runnerUpPoints: 30,
  thirdPlacePoints: 20,
  fourthPlacePoints: 10,
  topScorerPoints: 30,
  exactScorePoints: 5,
  correctSignPoints: 3,
  goalDiffBonusPoints: 1,
  survivorRoundPoints: 1,
  survivorLives: 1,
  survivorDrawSurvives: 0,
  fightWinnerPoints: 3,
  fightMethodPoints: 2,
  fightRoundPoints: 2,
  f1ExactPositionPoints: 10,
  f1PodiumPoints: 4,
  f1PolePoints: 5,
  f1FastestLapPoints: 3,
  nbaPlayInPoints: 5,
  nbaFirstRoundPoints: 10,
  nbaConferenceSemifinalPoints: 20,
  nbaConferenceFinalPoints: 30,
  nbaFinalsPoints: 50,
  nbaFirstRoundExactPoints: 5,
  nbaConferenceSemifinalExactPoints: 10,
  nbaConferenceFinalExactPoints: 15,
  nbaFinalsExactPoints: 25,
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
