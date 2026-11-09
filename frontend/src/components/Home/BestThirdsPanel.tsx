import { useMemo } from 'react';
import Flag from '../Flag';
import { rankBestThirds } from '../../utils/bestThirds';
import type { GroupStandings } from '../../types/api';

interface BestThirdsPanelProps {
  officialPoints: GroupStandings;
  /** Terceros que pasan a las eliminatorias: 8 en el Mundial, 4 en la Eurocopa. */
  qualifying?: number;
}

const CUT_LINE = 'border-b-2 [border-bottom-style:dashed] border-b-[rgba(255,_71,_87,_0.5)]';

function BestThirdsPanel({ officialPoints, qualifying = 8 }: BestThirdsPanelProps) {
  const thirds = useMemo(() => rankBestThirds(officialPoints), [officialPoints]);

  if (thirds.length === 0) return null;

  return (
    <div className="paper-panel album-sheet w-full max-w-145 my-0 mx-auto flex flex-col gap-2">
      <h3 className="album-sheet-title">Mejores terceros</h3>
      <div className="p-0.5">
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(200px,_1fr))] gap-4">
          <div className="flex flex-col">
            <div className="grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 pb-1.5 border-b border-b-line text-[0.75rem] text-muted font-bold text-center">
              <span>#</span>
              <span className="text-left">Equipo</span>
              <span>PT</span>
              <span>DF</span>
              <span title="Fair Play (Tarjetas)">FP</span>
            </div>
            <div className="flex flex-col">
              {thirds.slice(0, 6).map((t, idx) => {
                const qualifies = idx < qualifying;
                const rank = idx + 1;

                return (
                  <div
                    className={`grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 py-[5px] px-0 items-center text-[0.85rem] ${idx === qualifying - 1 ? CUT_LINE : 'border-b-0'}`}
                    key={t.name}
                    style={{ opacity: qualifies ? 1 : 0.5 }}
                  >
                    <span
                      className={`font-bold text-center ${qualifies ? 'text-[var(--hit)]' : 'text-muted'}`}
                    >
                      {rank}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Flag team={t.name} style={{ borderRadius: '2px', flexShrink: 0 }} />
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                        {t.name}
                      </span>
                    </div>
                    <span className="font-bold text-center bg-[rgba(17,24,39,0.06)] bg-none rounded-[4px]">
                      {t.pts}
                    </span>
                    <span className="text-center text-muted">
                      {t.diff > 0 ? `+${t.diff}` : t.diff}
                    </span>
                    <span
                      className="text-center text-muted text-[0.75rem]"
                      title="Puntos de Fair Play"
                    >
                      {t.fp || 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={thirds.length > 6 ? 'flex flex-col' : 'hidden'}>
            <div className="grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 pb-1.5 border-b border-b-line text-[0.75rem] text-muted font-bold text-center">
              <span>#</span>
              <span className="text-left">Equipo</span>
              <span>PT</span>
              <span>DF</span>
              <span title="Fair Play (Tarjetas)">FP</span>
            </div>
            <div className="flex flex-col">
              {thirds.slice(6, 12).map((t, idx) => {
                const globalIdx = idx + 6;
                const hasPlayed = t.mp > 0;
                const qualifies = hasPlayed && globalIdx < qualifying;
                const rank = hasPlayed ? globalIdx + 1 : '-';

                return (
                  <div
                    className={`grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 py-[5px] px-0 items-center text-[0.85rem] ${globalIdx === qualifying - 1 ? CUT_LINE : 'border-b-0'}`}
                    key={t.name}
                    style={{ opacity: qualifies ? 1 : hasPlayed ? 0.5 : 0.3 }}
                  >
                    <span
                      className={`font-bold text-center ${qualifies ? 'text-[var(--hit)]' : 'text-muted'}`}
                    >
                      {rank}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Flag team={t.name} style={{ borderRadius: '2px', flexShrink: 0 }} />
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                        {t.name}
                      </span>
                    </div>
                    <span className="font-bold text-center bg-[rgba(17,24,39,0.06)] bg-none rounded-[4px]">
                      {t.pts}
                    </span>
                    <span className="text-center text-muted">
                      {t.diff > 0 ? `+${t.diff}` : t.diff}
                    </span>
                    <span
                      className="text-center text-muted text-[0.75rem]"
                      title="Puntos de Fair Play"
                    >
                      {t.fp || 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BestThirdsPanel;
