import type { MatchRadar, TopScorer } from '../../types/api';
import LiveMatchesPanel from '../Home/LiveMatchesPanel';
import TopScorersPanel from '../Home/TopScorersPanel';
import { useRef, type Dispatch, type SetStateAction } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface BracketInfoPanelProps {
  activePanel: 'live' | 'scorers' | null;
  setActivePanel: Dispatch<SetStateAction<'live' | 'scorers' | null>>;
  matchRadar: MatchRadar;
  topScorers: TopScorer[];
  topScorersLoading: boolean;
  topScorersError: boolean;
  refreshTopScorers: () => void;
}

/** Panel flotante con los partidos en directo o los goleadores. */
export default function BracketInfoPanel({
  activePanel,
  setActivePanel,
  matchRadar,
  topScorers,
  topScorersLoading,
  topScorersError,
  refreshTopScorers,
}: BracketInfoPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onEscape: () => setActivePanel(null) });

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-start justify-center pt-[115px] pb-7.5 pl-[15px] pr-[15px] bg-transparent bg-none overflow-y-auto"
      onClick={() => setActivePanel(null)}
    >
      <div
        className="w-95 max-w-[92vw] max-h-[calc(100dvh_-_140px)] bg-[#0f172a] bg-none border border-[rgba(255,_255,_255,_0.15)] rounded-[16px] shadow-[0_10px_30px_rgba(0,_0,_0,_0.5)] flex flex-col overflow-hidden mt-2.5"
        role="dialog"
        aria-modal="true"
        aria-label={activePanel === 'live' ? 'Partidos en directo' : 'Goleadores'}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end items-center pt-3 pb-0 px-4 bg-transparent bg-none">
          <button
            className="bg-[rgba(255,_255,_255,_0.08)] bg-none border-none text-muted w-11 h-11 rounded-full flex items-center justify-center text-[1rem] cursor-pointer [transition:all_0.2s]"
            type="button"
            aria-label="Cerrar"
            onClick={() => setActivePanel(null)}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            ✕
          </button>
        </div>

        <div className="pt-2 pb-4 px-4 overflow-y-auto flex-1">
          {activePanel === 'live' && (
            <LiveMatchesPanel
              liveMatches={matchRadar?.live || []}
              matchRadar={matchRadar}
              maxNext={3}
            />
          )}
          {activePanel === 'scorers' && (
            <TopScorersPanel
              topScorers={topScorers}
              loading={topScorersLoading}
              error={topScorersError}
              onRetry={refreshTopScorers}
            />
          )}
        </div>
      </div>
    </div>
  );
}
