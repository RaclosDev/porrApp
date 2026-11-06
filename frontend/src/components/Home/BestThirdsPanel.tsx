import { useMemo } from 'react';
import Flag from '../Flag';
import { rankBestThirds } from '../../utils/bestThirds';
import type { GroupStandings } from '../../types/api';

interface BestThirdsPanelProps {
  officialPoints: GroupStandings;
}

function BestThirdsPanel({ officialPoints }: BestThirdsPanelProps) {
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
                const isTop8 = idx < 8;
                const rank = idx + 1;

                return (
                  <div
                    className="grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 py-[5px] px-0 items-center text-[0.85rem]"
                    key={t.name}
                  >
                    <span
                      className={`font-bold text-center ${isTop8 ? 'text-[var(--hit)]' : 'text-muted'}`}
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

          <div className="flex flex-col">
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
                const isTop8 = hasPlayed && globalIdx < 8;
                const rank = hasPlayed ? globalIdx + 1 : '-';

                return (
                  <div
                    className={`grid grid-cols-[20px_1fr_25px_30px_28px] gap-1.5 py-[5px] px-0 items-center text-[0.85rem] ${globalIdx === 7 ? 'border-b-2 [border-bottom-style:dashed] border-b-[rgba(255,_71,_87,_0.5)]' : 'border-b-0'}`}
                    key={t.name}
                    style={{ opacity: isTop8 ? 1 : hasPlayed ? 0.5 : 0.3 }}
                  >
                    <span
                      className={`font-bold text-center ${isTop8 ? 'text-[var(--hit)]' : 'text-muted'}`}
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
