import type { MatchRadar, TopScorer } from '../../types/api';
import LiveMatchesPanel from '../Home/LiveMatchesPanel';
import TopScorersPanel from '../Home/TopScorersPanel';
import type { Dispatch, SetStateAction } from 'react';

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
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '115px',
        paddingBottom: '30px',
        paddingLeft: '15px',
        paddingRight: '15px',
        background: 'transparent',
        overflowY: 'auto',
      }}
      onClick={() => setActivePanel(null)}
    >
      <div
        style={{
          width: '380px',
          maxWidth: '92vw',
          maxHeight: 'calc(100vh - 140px)',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalScaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          marginTop: '10px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del HUD */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '12px 16px 0 16px',
            background: 'transparent',
          }}
        >
          <button
            onClick={() => setActivePanel(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-muted)',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
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

        {/* Contenido del HUD */}
        <div style={{ padding: '8px 16px 16px 16px', overflowY: 'auto', flex: 1 }}>
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
