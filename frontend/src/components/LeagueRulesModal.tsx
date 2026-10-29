import React from 'react';

/**
 * Modal de solo lectura con las reglas personalizadas de una liga.
 * Cada liga define las suyas desde el panel de administración.
 */
export default function LeagueRulesModal({
  group,
  onClose,
}: {
  group: { name?: string; rules?: string | null } | null | undefined;
  onClose: () => void;
}) {
  const rules = (group?.rules || '').trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-rules-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          background: '#0f172a',
          border: '1px solid rgba(0, 210, 211, 0.3)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#00d2d3',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              📖 Reglas de la liga
            </div>
            <h2
              id="league-rules-title"
              style={{
                margin: 0,
                fontSize: '1.15rem',
                color: '#fff',
                fontWeight: 800,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {group?.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar reglas"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
          {rules ? (
            <p
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                fontSize: '0.92rem',
                color: '#e2e8f0',
              }}
            >
              {rules}
            </p>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              El administrador de esta liga todavía no ha definido reglas propias.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
