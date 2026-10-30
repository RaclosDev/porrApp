import { useState } from 'react';
import Flag from '../Flag';
import type { TopScorer } from '../../types/api';

interface TopScorersPanelProps {
  topScorers: TopScorer[];
  hideTitle?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

/** Máximos goleadores (Pichichi) del torneo. */
function TopScorersPanel({
  topScorers,
  hideTitle = false,
  loading = false,
  error = false,
  onRetry,
}: TopScorersPanelProps) {
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  if (loading || error || !topScorers || topScorers.length === 0) {
    return (
      <div className="paper-panel album-sheet w-full max-w-145 my-0 mx-auto flex flex-col gap-2">
        {!hideTitle && <h3 className="album-sheet-title">Pichichi</h3>}
        <div className="text-center text-muted p-5 text-[0.9rem]">
          {loading
            ? 'Cargando goleadores…'
            : error
              ? 'No se han podido cargar los goleadores.'
              : 'Todavía no hay datos de goleadores disponibles.'}
          {error && onRetry && (
            <button
              className="block mt-3 mb-0 mx-auto py-2 px-3.5 rounded-[8px] border border-cyan bg-[rgba(0,_210,_211,_0.12)] bg-none text-main font-bold cursor-pointer"
              type="button"
              onClick={onRetry}
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  const maxGoals = topScorers[0].goals;
  const left = topScorers.slice(0, 2);
  const right = topScorers.slice(2, 4);

  const uniqueGoals = [...new Set(topScorers.slice(0, 4).map((s) => s.goals))];
  const getMedal = (goals: number, idx: number) => {
    const rank = uniqueGoals.indexOf(goals);
    if (rank === 0) return '👑';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return idx + 1;
  };

  const renderScorer = (s: TopScorer, idx: number) => {
    const isLeader = s.goals === maxGoals;
    const isVinicius =
      (s.name || s.shortName || '').toLowerCase().includes('vinicius') ||
      (s.shortName || s.name || '').toLowerCase().includes('viní') ||
      (s.shortName || s.name || '').includes('V. Júnior') ||
      (s.shortName || s.name || '').includes('V. Junior');
    const imageUrl = isVinicius
      ? 'https://r2.thesportsdb.com/images/media/player/cartoon/vq5z4u1771264896.png'
      : s.imageUrl;
    const medal = getMedal(s.goals, idx);

    return (
      <div className="flex items-center gap-2.5 py-2.5 px-0 border-b-0" key={s.playerId || idx}>
        <span
          className={`w-5.5 text-center font-bold text-[1rem] shrink-0 ${isLeader ? 'text-gold' : 'text-muted'}`}
        >
          {medal}
        </span>
        <div className="w-11 h-11 rounded-full bg-[rgba(17,24,39,0.08)] bg-none shrink-0 overflow-hidden flex items-center justify-center">
          {imageUrl && !imgErrors[s.playerId] ? (
            <div className="w-full h-full overflow-hidden flex items-start justify-center">
              <img
                className="w-auto h-[200%] max-w-[none]"
                src={imageUrl}
                alt=""
                onError={() => setImgErrors((prev) => ({ ...prev, [s.playerId]: true }))}
              />
            </div>
          ) : (
            <span className="text-[1rem] font-bold text-gold">
              {(s.shortName || s.name || '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Flag team={s.team} style={{ borderRadius: '2px', flexShrink: 0, width: '18px' }} />
          <div className="font-bold text-[0.9rem] whitespace-nowrap overflow-hidden text-ellipsis">
            {s.shortName || s.name}
          </div>
        </div>
        <div
          className={`font-bold text-[1.2rem] min-w-6 text-right ${isLeader ? 'text-gold' : 'text-main'}`}
        >
          {s.goals}
        </div>
      </div>
    );
  };

  return (
    <div className="paper-panel album-sheet w-full max-w-145 my-0 mx-auto flex flex-col gap-2">
      {!hideTitle && <h3 className="album-sheet-title">Pichichi</h3>}
      <div className="glass-panel p-2.5 rounded-[16px]">
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(200px,_1fr))] gap-[0_16px]">
          <div className="flex flex-col">{left.map((s, idx) => renderScorer(s, idx))}</div>
          <div className="flex flex-col">{right.map((s, idx) => renderScorer(s, idx + 2))}</div>
        </div>
      </div>
    </div>
  );
}

export default TopScorersPanel;
