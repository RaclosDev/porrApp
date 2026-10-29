import type { Match, TeamStanding } from '../types/api';

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
