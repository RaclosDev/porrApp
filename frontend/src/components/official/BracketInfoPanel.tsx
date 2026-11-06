import type { MatchRadar, TopScorer } from '../../types/api';
import DialogBackdrop from '../DialogBackdrop';
import LiveMatchesPanel from '../Home/LiveMatchesPanel';
import TopScorersPanel from '../Home/TopScorersPanel';
import { useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface BracketInfoPanelProps {
  activePanel: 'live' | 'scorers' | null;
  setActivePanel: Dispatch<SetStateAction<'live' | 'scorers' | null>>;
  matchRadar?: MatchRadar;
  topScorers?: TopScorer[];
  topScorersLoading?: boolean;
  topScorersError?: boolean;
  refreshTopScorers?: () => void;
  /** Contenido propio del panel, en lugar de los partidos y goleadores del torneo oficial. */
  children?: ReactNode;
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
  children,
}: BracketInfoPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onEscape: () => setActivePanel(null) });

  return (
    <DialogBackdrop className="paper-dialog-overlay" onDismiss={() => setActivePanel(null)}>
      <div
        className="paper-panel landing-tape paper-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={activePanel === 'live' ? 'Partidos en directo' : 'Goleadores'}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="paper-dialog-heading">
          <h2 className="poster-title m-0 text-xl">
            {activePanel === 'live' ? 'Partidos' : 'Pichichi'}
          </h2>
          <button
            className="paper-dialog-close"
            type="button"
            aria-label="Cerrar"
            onClick={() => setActivePanel(null)}
          >
            ✕
          </button>
        </div>

        <div className="paper-dialog-body">
          {children}
          {!children && activePanel === 'live' && (
            <LiveMatchesPanel
              liveMatches={matchRadar?.live || []}
              matchRadar={matchRadar}
              maxNext={3}
            />
          )}
          {!children && activePanel === 'scorers' && (
            <TopScorersPanel
              hideTitle
              topScorers={topScorers ?? []}
              loading={topScorersLoading}
              error={topScorersError}
              onRetry={refreshTopScorers}
            />
          )}
        </div>
      </div>
    </DialogBackdrop>
  );
}
