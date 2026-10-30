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
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {!hideTitle && (
          <div
            style={{
              textAlign: 'center',
              color: '#ffd32a',
              fontSize: '1rem',
              fontWeight: 'bold',
              padding: '6px',
              background: 'rgba(255, 211, 42, 0.1)',
              border: '1px solid rgba(255, 211, 42, 0.3)',
              borderRadius: '12px',
            }}
          >
            🏆 PICHICHI
          </div>
        )}
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            padding: '20px',
            fontSize: '0.9rem',
          }}
        >
          {loading
            ? 'Cargando goleadores…'
            : error
              ? 'No se han podido cargar los goleadores.'
              : 'Todavía no hay datos de goleadores disponibles.'}
          {error && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                display: 'block',
                margin: '12px auto 0',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--accent-cyan, #00d2d3)',
                background: 'rgba(0, 210, 211, 0.12)',
                color: 'var(--text-main, #fff)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
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
      <div
        key={s.playerId || idx}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 0',
          borderBottom: 'none',
        }}
      >
        <span
          style={{
            width: '22px',
            textAlign: 'center',
            fontWeight: 'bold',
            color: isLeader ? '#ffd32a' : 'var(--text-muted)',
            fontSize: '1rem',
            flexShrink: 0,
          }}
        >
          {medal}
        </span>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {imageUrl && !imgErrors[s.playerId] ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
              }}
            >
              <img
                src={imageUrl}
                alt=""
                style={{ width: 'auto', height: '200%', maxWidth: 'none' }}
                onError={() => setImgErrors((prev) => ({ ...prev, [s.playerId]: true }))}
              />
            </div>
          ) : (
            <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ffd32a' }}>
              {(s.shortName || s.name || '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Flag team={s.team} style={{ borderRadius: '2px', flexShrink: 0, width: '18px' }} />
          <div
            style={{
              fontWeight: 'bold',
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s.shortName || s.name}
          </div>
        </div>
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '1.2rem',
            color: isLeader ? '#ffd32a' : 'var(--text-main)',
            minWidth: '24px',
            textAlign: 'right',
          }}
        >
          {s.goals}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '580px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {!hideTitle && (
        <div
          style={{
            textAlign: 'center',
            color: '#ffd32a',
            fontSize: '1rem',
            fontWeight: 'bold',
            padding: '6px',
            background: 'rgba(255, 211, 42, 0.1)',
            border: '1px solid rgba(255, 211, 42, 0.3)',
            borderRadius: '12px',
          }}
        >
          🏆 PICHICHI
        </div>
      )}
      <div className="glass-panel" style={{ padding: '10px', borderRadius: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0 16px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {left.map((s, idx) => renderScorer(s, idx))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {right.map((s, idx) => renderScorer(s, idx + 2))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopScorersPanel;
