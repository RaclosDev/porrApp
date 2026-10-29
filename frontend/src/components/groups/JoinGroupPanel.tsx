import type { GroupsDashboardState } from '../../hooks/useGroupsDashboard';
interface JoinGroupPanelProps {
  joinCode: GroupsDashboardState['joinCode'];
  setJoinCode: GroupsDashboardState['setJoinCode'];
  handleJoin: GroupsDashboardState['handleJoin'];
  setShowJoinModal: (show: boolean) => void;
}

/** Formulario para unirse a una liga con su código. */
export default function JoinGroupPanel({
  joinCode,
  setJoinCode,
  handleJoin,
  setShowJoinModal,
}: JoinGroupPanelProps) {
  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto 30px auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          border: '1px solid #9b59b6',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3
            style={{
              margin: 0,
              color: '#9b59b6',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            🎟️ Unirse con Código
          </h3>
          <button
            type="button"
            onClick={() => setShowJoinModal(false)}
            aria-label="Cerrar"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Cerrar"
          >
            ✕
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
          ¿Tienes un código de invitación de 6 letras? Introdúcelo aquí para acceder directamente a
          la liga:
        </p>
        <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Ej: X9K2PL"
            aria-label="Código de invitación de 6 letras"
            maxLength={6}
            className="glass-input"
            style={{
              flex: 1,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontWeight: 'bold',
            }}
          />
          <button
            type="submit"
            className="glass-btn primary-btn"
            style={{ background: '#9b59b6', borderColor: '#9b59b6', fontWeight: 'bold' }}
          >
            Unirse
          </button>
        </form>
      </div>
    </div>
  );
}
