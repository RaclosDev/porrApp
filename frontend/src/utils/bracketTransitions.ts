import type { BracketMatch, BracketState, BracketTeam } from '../store/useAppStore';

type Side = 'left' | 'right';
const clone = (state: BracketState): BracketState => JSON.parse(JSON.stringify(state));
const contains = (match: BracketMatch | null | undefined, team: BracketTeam | null | undefined) =>
  Boolean(team && (match?.home?.name === team.name || match?.away?.name === team.name));

function keepValidPodium(state: BracketState) {
  if (!contains(state.final, state.champion)) state.champion = null;
  if (!contains(state.thirdPlaceMatch, state.thirdPlaceWinner)) state.thirdPlaceWinner = null;
}

/** Revisa solo los cruces que dependen del participante cambiado. */
function repairPath(state: BracketState, side: Side, round: number, matchIndex: number) {
  const rounds = [state.r32, state.r16, state.qf, state.sf];
  for (let current = round; current < 3; current++) {
    const source = rounds[current][side][matchIndex];
    const nextIndex = Math.floor(matchIndex / 2);
    const target = rounds[current + 1][side][nextIndex];
    if (!target) return;
    const slot = matchIndex % 2 === 0 ? 'home' : 'away';
    if (contains(source, target[slot])) return;
    target[slot] = null;
    matchIndex = nextIndex;
  }

  const semi = state.sf[side][0];
  const slot = side === 'left' ? 'home' : 'away';
  const finalist = state.final?.[slot];
  const validFinalist = contains(semi, finalist);
  if (state.final && !validFinalist) state.final[slot] = null;
  if (state.thirdPlaceMatch) {
    state.thirdPlaceMatch[slot] =
      validFinalist && semi ? (semi.home?.name === finalist?.name ? semi.away : semi.home) : null;
  }
  keepValidPodium(state);
}

export function replaceR32Team(
  state: BracketState,
  name: string,
  side: Side,
  matchIndex: number,
  isHome: boolean,
): BracketState {
  const slot = isHome ? 'home' : 'away';
  const match = state.r32[side][matchIndex];
  if (!match || match[slot]?.name === name) return state;
  const next = clone(state);
  next.r32[side][matchIndex][slot] = { name, id: `${side}_${matchIndex}_${slot}` };
  repairPath(next, side, 0, matchIndex);
  return next;
}

export function advanceBracketWinner(
  state: BracketState,
  team: BracketTeam | null | undefined,
  side: Side | 'center',
  round: number,
  matchIndex: number,
): BracketState {
  if (!team || team.name.includes('º')) return state;
  const rounds = [state.r32, state.r16, state.qf, state.sf];
  const source =
    round === 4
      ? state.final
      : round === 5
        ? state.thirdPlaceMatch
        : side !== 'center'
          ? rounds[round]?.[side][matchIndex]
          : null;
  if (!contains(source, team)) return state;
  const next = clone(state);
  if (round < 3 && side !== 'center') {
    const nextIndex = Math.floor(matchIndex / 2);
    const target = [next.r16, next.qf, next.sf][round][side][nextIndex];
    if (!target) return state;
    target[matchIndex % 2 === 0 ? 'home' : 'away'] = { ...team };
    repairPath(next, side, round + 1, nextIndex);
  } else if (round === 3 && side !== 'center') {
    const slot = side === 'left' ? 'home' : 'away';
    next.final ??= { id: 'FINAL', home: null, away: null };
    next.thirdPlaceMatch ??= { id: 'THIRD', home: null, away: null };
    next.final[slot] = { ...team };
    repairPath(next, side, 3, matchIndex);
  } else if (round === 4) next.champion = { ...team };
  else if (round === 5) next.thirdPlaceWinner = { ...team };
  return next;
}
