import type { GroupsDashboardState } from '../../hooks/useGroupsDashboard';
import type { Group } from '../../types/api';

interface CreatedLeagueModalProps {
  newlyCreatedGroup: Group;
  setNewlyCreatedGroup: GroupsDashboardState['setNewlyCreatedGroup'];
  handleCopyCode: GroupsDashboardState['handleCopyCode'];
  handleCopyLink: GroupsDashboardState['handleCopyLink'];
  handleShareWhatsApp: GroupsDashboardState['handleShareWhatsApp'];
  navigate: GroupsDashboardState['navigate'];
}

/** Aviso tras crear una liga, con su código para invitar. */
export default function CreatedLeagueModal({
  newlyCreatedGroup,
  setNewlyCreatedGroup,
  handleCopyCode,
  handleCopyLink,
  handleShareWhatsApp,
  navigate,
}: CreatedLeagueModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #00d2d3',
          borderRadius: '16px',
          maxWidth: '480px',
          width: '100%',
          padding: '28px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        <button
          onClick={() => setNewlyCreatedGroup(null)}
          style={{
            position: 'absolute',
            top: '14px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '1.4rem',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🎉 🏆</div>
        <h2 style={{ color: '#00d2d3', margin: '0 0 8px 0', fontSize: '1.5rem' }}>
          ¡Tu liga está lista!
        </h2>
        <p
          style={{
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            margin: '0 0 16px 0',
          }}
        >
          "{newlyCreatedGroup.name}"
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Comparte este código o enlace con tus amigos para que puedan unirse y empezar a
          pronosticar.
        </p>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px dashed #00d2d3',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            CÓDIGO DE INVITACIÓN
          </div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: '900',
              letterSpacing: '6px',
              color: '#fbc531',
              marginBottom: '10px',
            }}
          >
            {newlyCreatedGroup.joinCode}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleCopyCode(newlyCreatedGroup.joinCode)}
              className="glass-btn"
              style={{ fontSize: '0.85rem', padding: '6px 14px' }}
            >
              📋 Copiar Código
            </button>
            <button
              type="button"
              onClick={() => handleCopyLink(newlyCreatedGroup.joinCode)}
              className="glass-btn"
              style={{ fontSize: '0.85rem', padding: '6px 14px' }}
            >
              🔗 Copiar Enlace
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => handleShareWhatsApp(newlyCreatedGroup)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: '#25D366',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>💬</span> Compartir por WhatsApp
          </button>

          <button
            type="button"
            onClick={() => {
              const format = newlyCreatedGroup.poolFormat;
              setNewlyCreatedGroup(null);
              if (format === 'MATCH_DAY') {
                navigate('/jornadas');
              } else {
                navigate('/prediction');
              }
            }}
            className="glass-btn primary-btn"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.95rem',
              background: '#00d2d3',
              color: '#0f172a',
              fontWeight: 'bold',
            }}
          >
            Comenzar mis Pronósticos ➜
          </button>
        </div>
      </div>
    </div>
  );
}
