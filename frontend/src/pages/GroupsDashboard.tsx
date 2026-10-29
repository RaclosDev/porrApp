import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import GroupMembersModal from '../components/GroupMembersModal';
import LeagueRulesModal from '../components/LeagueRulesModal';
import { LeagueAvatar } from '../components/Avatar';
import { GoogleLogin } from '@react-oauth/google';
import { POOL_FORMATS, useGroupsDashboard } from '../hooks/useGroupsDashboard';

/**
 * Vista del listado y gestión de grupos/ligas disponibles.
 * Permite buscar, crear o unirse a ligas con contraseñas,
 * además de administrar las propias en caso de ser el administrador.
 *
 * @component
 * @returns {JSX.Element} Vista del dashboard de grupos.
 */
export default function GroupsDashboard() {
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState(null);
  const [selectedGroupForRules, setSelectedGroupForRules] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const {
    groups,
    competitions,
    loading,
    error,
    newGroupName,
    setNewGroupName,
    selectedCompetition,
    setSelectedCompetition,
    selectedBetMode,
    setSelectedBetMode,
    includePichichi,
    setIncludePichichi,
    newlyCreatedGroup,
    setNewlyCreatedGroup,
    pendingJoinCodeNotice,
    pendingInvite,
    handleAcceptPendingInvite,
    isJoiningInvite,
    joinCode,
    setJoinCode,
    isCreating,
    handleCreate,
    handleJoin,
    handleSaveGroupConfig,
    handleUploadGroupImage,
    handleRemoveGroupImage,
    handleDeleteGroup,
    handleEnterGroup,
    handleLeaveGroup,
    handleCopyCode,
    handleCopyLink,
    handleShareWhatsApp,
    userName,
    userId,
    activeGroupId,
    navigate,
  } = useGroupsDashboard();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setShowJoinModal(false);
        // El modal de administración gestiona su propio Escape para proteger cambios sin guardar.
        setSelectedGroupForRules(null);
        setNewlyCreatedGroup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setNewlyCreatedGroup]);

  const handleDirectGoogleLogin = async (credentialResponse) => {
    try {
      const res = await fetch('/api/auth/google/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();
      if (data.status === 'requires_name') {
        const name = prompt('¡Bienvenido! Elige tu apodo para la porra:') || '';
        if (!name.trim()) return;
        const res2 = await fetch('/api/auth/google/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential: credentialResponse.credential,
            participantName: name.trim(),
          }),
        });
        const data2 = await res2.json();
        if (data2.token) {
          localStorage.setItem('token', data2.token);
          localStorage.setItem('my_prediction_name', data2.participantName);
          localStorage.setItem('my_bet_name', data2.participantName);
          if (data2.userId) localStorage.setItem('my_user_id', data2.userId);
          window.location.reload();
        }
      } else if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('my_prediction_name', data.participantName);
        localStorage.setItem('my_bet_name', data.participantName);
        if (data.userId) localStorage.setItem('my_user_id', data.userId);
        window.location.reload();
      }
    } catch (err) {
      toast.error('Error al iniciar sesión con Google: ' + err.message);
    }
  };

  const inviteSummary = pendingJoinCodeNotice ? (
    <div
      className="glass-panel invite-summary-card"
      style={{
        maxWidth: 520,
        width: '100%',
        margin: '0 auto 24px',
        boxSizing: 'border-box',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        textAlign: 'left',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 64 }}>
        {pendingInvite?.imageUrl ? (
          <img
            src={pendingInvite.imageUrl}
            alt={pendingInvite.name ? `Imagen de ${pendingInvite.name}` : 'Imagen de la liga'}
            style={{
              display: 'block',
              width: 64,
              height: 64,
              flex: '0 0 64px',
              borderRadius: 12,
              objectFit: 'cover',
            }}
          />
        ) : (
          <LeagueAvatar name={pendingInvite?.name || 'Invitación'} size={64} />
        )}
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <h2
            style={{
              fontSize: '1.15rem',
              lineHeight: 1.2,
              margin: '0 0 4px',
              color: 'var(--text-primary, #fff)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={pendingInvite?.name || 'Cargando liga…'}
          >
            {pendingInvite?.name || 'Cargando liga…'}
          </h2>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: 999,
            background: 'rgba(162, 155, 254, 0.14)',
            border: '1px solid rgba(162, 155, 254, 0.35)',
            color: '#a29bfe',
          }}
        >
          {pendingInvite?.competitionName || 'Fútbol'}
        </span>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: 999,
            background: 'rgba(0, 210, 211, 0.1)',
            border: '1px solid rgba(0, 210, 211, 0.3)',
            color: '#00d2d3',
          }}
        >
          {pendingInvite?.poolFormat === 'MATCH_DAY'
            ? 'Jornadas'
            : pendingInvite?.poolFormat === 'KNOCKOUTS_ONLY'
              ? 'Eliminatorias'
              : pendingInvite?.poolFormat === 'FULL_BRACKET'
                ? 'Cuadro completo'
                : 'Porra de fútbol'}
        </span>
      </div>
      {userName ? (
        <button
          type="button"
          onClick={handleAcceptPendingInvite}
          disabled={!pendingInvite || isJoiningInvite}
          style={{
            width: '100%',
            marginTop: 2,
            border: 0,
            borderRadius: 10,
            padding: '10px 14px',
            background: 'linear-gradient(135deg, #00d2d3, #00a8ff)',
            color: '#0f172a',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: pendingInvite && !isJoiningInvite ? 'pointer' : 'wait',
            opacity: pendingInvite && !isJoiningInvite ? 1 : 0.65,
          }}
        >
          {isJoiningInvite ? 'Uniéndote…' : 'Unirme a la liga'}
        </button>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
          <GoogleLogin
            onSuccess={handleDirectGoogleLogin}
            onError={() => toast.error('Inicio de sesión cancelado')}
            theme="filled_black"
            shape="pill"
            text="continue_with"
          />
        </div>
      )}
    </div>
  ) : null;

  if (!userName) {
    return (
      <div
        className={
          pendingJoinCodeNotice ? 'join-auth-screen has-pending-invite' : 'join-auth-screen'
        }
        style={{
          textAlign: 'center',
          padding: 'clamp(16px, 4vw, 32px)',
          color: 'white',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {inviteSummary}

        {!pendingJoinCodeNotice && (
          <>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
              Debes iniciar sesión con Google
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Para crear o unirte a una liga, necesitas acceder con tu cuenta de Google:
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleDirectGoogleLogin}
                onError={() => toast.error('Inicio de sesión cancelado')}
                theme="filled_black"
                shape="pill"
                text="continue_with"
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="view-section active">
      {inviteSummary}
      {/* Modal de Activación / Celebración tras crear grupo */}
      {newlyCreatedGroup && (
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
              <div
                style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}
              >
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
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#fff', fontWeight: 800 }}>
            Mis Ligas
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setShowJoinModal((prev) => !prev);
              setShowCreateModal(false);
            }}
            className="glass-btn"
            style={{
              padding: '8px 16px',
              fontSize: '0.88rem',
              fontWeight: 700,
              borderRadius: '10px',
              border: showJoinModal ? '1px solid #9b59b6' : '1px solid rgba(255,255,255,0.15)',
              background: showJoinModal ? 'rgba(155, 89, 182, 0.25)' : 'rgba(255,255,255,0.06)',
              color: showJoinModal ? '#e056fd' : '#fff',
              cursor: 'pointer',
            }}
          >
            🎟️ Unirse con Código
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreateModal((prev) => !prev);
              setShowJoinModal(false);
            }}
            className="glass-btn primary-btn"
            style={{
              padding: '8px 18px',
              fontSize: '0.88rem',
              fontWeight: 800,
              borderRadius: '10px',
              background: showCreateModal
                ? 'rgba(255,255,255,0.12)'
                : 'linear-gradient(135deg, #00d2d3, #00a8ff)',
              color: showCreateModal ? '#fff' : '#0f172a',
              border: showCreateModal ? '1px solid rgba(255,255,255,0.2)' : 'none',
              boxShadow: showCreateModal ? 'none' : '0 4px 15px rgba(0, 210, 211, 0.3)',
              cursor: 'pointer',
            }}
          >
            {showCreateModal ? '✕ Cancelar Creación' : '➕ Crear Nueva Liga'}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(231, 76, 60, 0.2)',
            border: '1px solid #e74c3c',
            color: '#ffcccc',
            padding: '15px',
            borderRadius: '12px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* Asistente de Creación de Liga */}
      {showCreateModal && (
        <div
          style={{
            maxWidth: '820px',
            margin: '0 auto 30px auto',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: '1px solid #00d2d3',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3
                style={{
                  margin: 0,
                  color: 'var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                🏆 Crear Nueva Liga
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Cerrar modal"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  minWidth: '40px',
                  minHeight: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCreate}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Nombre de tu Liga:
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ej: Amigos del Barrio, Porra Oficina 2026..."
                  aria-label="Nombre del nuevo grupo"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                    }}
                  >
                    Competición Deportiva:
                  </label>
                  <select
                    aria-label="Seleccionar competición deportiva"
                    value={selectedCompetition}
                    onChange={(e) => setSelectedCompetition(e.target.value)}
                    className="glass-input"
                    style={{ width: '100%' }}
                  >
                    {competitions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1 1 200px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                    }}
                  >
                    Modalidad / Formato:
                  </label>
                  <select
                    aria-label="Seleccionar formato de porra"
                    value={selectedBetMode}
                    onChange={(e) => setSelectedBetMode(e.target.value)}
                    className="glass-input"
                    style={{ width: '100%' }}
                  >
                    {POOL_FORMATS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              >
                <input
                  type="checkbox"
                  checked={includePichichi}
                  onChange={(e) => setIncludePichichi(e.target.checked)}
                />
                <span>Incluir Porra de Máximo Goleador (Pichichi)</span>
              </label>

              <button
                type="submit"
                disabled={isCreating}
                className="glass-btn primary-btn"
                style={{
                  padding: '12px',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  marginTop: '6px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                }}
              >
                {isCreating ? '⏳ Creando Liga...' : '🚀 Crear Liga'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Unirse con Código */}
      {showJoinModal && (
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
              ¿Tienes un código de invitación de 6 letras? Introdúcelo aquí para acceder
              directamente a la liga:
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
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          Cargando tus ligas...
        </div>
      ) : groups.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            maxWidth: '560px',
            margin: '20px auto 40px',
            borderRadius: '16px',
            border: '1px dashed rgba(0, 210, 211, 0.4)',
            background: 'rgba(0, 210, 211, 0.04)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏟️</div>
          <h3 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: 800 }}>
            Aún no te has unido a ninguna liga privada
          </h3>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.92rem',
              maxWidth: '420px',
              margin: '0 auto 24px',
              lineHeight: 1.5,
            }}
          >
            Crea tu propia porra personalizada para competir con tus amigos o únete a una ya
            existente usando un código de invitación.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setShowJoinModal(false);
              }}
              className="glass-btn primary-btn"
              style={{
                padding: '11px 22px',
                fontWeight: 800,
                fontSize: '0.95rem',
                background: 'linear-gradient(135deg, #00d2d3, #00a8ff)',
                color: '#0f172a',
                boxShadow: '0 4px 15px rgba(0, 210, 211, 0.3)',
              }}
            >
              ➕ Crear mi primera liga
            </button>
            <button
              type="button"
              onClick={() => {
                setShowJoinModal(true);
                setShowCreateModal(false);
              }}
              className="glass-btn"
              style={{ padding: '11px 20px', fontWeight: 700, fontSize: '0.95rem' }}
            >
              🎟️ Unirse con código
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {groups.map((group) => {
            const isSelected = activeGroupId && activeGroupId.toString() === group.id.toString();
            const isCreator =
              (group.adminUserId && userId && String(group.adminUserId) === String(userId)) ||
              (group.adminParticipantName &&
                userName &&
                group.adminParticipantName.toLowerCase() === userName.toLowerCase());
            return (
              <div
                key={group.id}
                className="glass-panel"
                style={{
                  flex: '1',
                  minWidth: '280px',
                  maxWidth: '360px',
                  padding: '20px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderRadius: '16px',
                  background:
                    'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
                  border: isSelected ? '2px solid #00d2d3' : '1px solid var(--border-color)',
                  boxShadow: isSelected
                    ? '0 8px 24px rgba(0, 210, 211, 0.18)'
                    : '0 4px 14px rgba(0, 0, 0, 0.25)',
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      left: '15px',
                      background: '#00d2d3',
                      color: '#000',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                    }}
                  >
                    SELECCIONADA
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    minHeight: '64px',
                  }}
                >
                  <LeagueAvatar url={group.imageUrl} size={64} />
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: '1.15rem',
                        margin: '0 0 4px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={group.name}
                    >
                      {group.name}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                      Admin: <strong>{group.adminParticipantName}</strong>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {isCreator && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: 'rgba(255, 193, 7, 0.14)',
                        border: '1px solid rgba(255, 193, 7, 0.4)',
                        color: '#ffc107',
                      }}
                    >
                      👑 Administras
                    </span>
                  )}
                  {group.competitionName && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: 'rgba(162, 155, 254, 0.14)',
                        border: '1px solid rgba(162, 155, 254, 0.35)',
                        color: '#a29bfe',
                      }}
                    >
                      {group.competitionName}
                    </span>
                  )}
                  {group.poolFormat && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: 'rgba(0, 210, 211, 0.1)',
                        border: '1px solid rgba(0, 210, 211, 0.3)',
                        color: '#00d2d3',
                      }}
                    >
                      {group.poolFormat === 'MATCH_DAY' ? 'Jornadas' : 'Cuadro'}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: 'auto',
                    paddingTop: '10px',
                  }}
                >
                  {isSelected ? (
                    <div
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(0, 210, 211, 0.12)',
                        border: '1px solid #00d2d3',
                        color: '#00d2d3',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span>✓</span>
                      <span>Liga Actual</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEnterGroup(group.id)}
                      className="glass-btn primary-btn"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                      }}
                    >
                      <span>Acceder a esta Liga</span>
                      <span>→</span>
                    </button>
                  )}

                  {group.joinCode && (
                    <div
                      style={{ display: 'flex', alignItems: 'stretch', gap: '8px', width: '100%' }}
                    >
                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(group)}
                        className="glass-btn"
                        style={{
                          flex: '1 1 auto',
                          minWidth: 0,
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '7px',
                          color: '#fff',
                          background: 'linear-gradient(135deg, #25D366, #128C7E)',
                          border: '1px solid rgba(37, 211, 102, 0.55)',
                          boxSizing: 'border-box',
                        }}
                        title="Invitar por WhatsApp"
                        aria-label={`Invitar a ${group.name} por WhatsApp`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.5 0 .14 5.35.14 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.25-1.64a11.94 11.94 0 0 0 5.82 1.49h.01c6.58 0 11.94-5.36 11.94-11.94 0-3.19-1.24-6.19-3.5-8.43ZM12.08 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.71.97.99-3.62-.23-.37a9.88 9.88 0 0 1-1.52-5.25c0-5.46 4.44-9.9 9.9-9.9a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.9 7c0 5.46-4.45 9.9-9.92 9.9Zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
                        </svg>
                        <span>Invitar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(group.joinCode)}
                        className="glass-btn"
                        style={{
                          flex: '0 0 auto',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          color: '#fff',
                          background: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid var(--border-color)',
                          whiteSpace: 'nowrap',
                        }}
                        title="Copiar código de invitación"
                        aria-label={`Copiar código de invitación de ${group.name}`}
                      >
                        {group.joinCode}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(group.joinCode)}
                        className="glass-btn"
                        style={{
                          flex: '0 0 42px',
                          width: 42,
                          padding: '10px 0',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          color: '#fff',
                          background: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid var(--border-color)',
                        }}
                        title="Copiar enlace de invitación"
                        aria-label={`Copiar enlace de invitación de ${group.name}`}
                      >
                        🔗
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedGroupForRules(group)}
                      className="glass-btn"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                      }}
                      title="Ver las reglas de esta liga"
                      aria-label="Ver las reglas de esta liga"
                    >
                      <span>📖</span>
                      <span>Reglas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedGroupForMembers(group)}
                      className="glass-btn"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        color: '#00d2d3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                      }}
                      title={isCreator ? 'Administrar liga' : 'Ver participantes'}
                      aria-label={isCreator ? 'Administrar liga' : 'Ver participantes'}
                    >
                      <span>{isCreator ? '⚙️' : '👥'}</span>
                      <span>{isCreator ? 'Administrar' : 'Miembros'}</span>
                    </button>
                  </div>

                  {!isCreator && (
                    <button
                      type="button"
                      onClick={() => handleLeaveGroup(group.id, group.name)}
                      className="glass-btn"
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        background: 'rgba(231, 76, 60, 0.15)',
                        border: '1px solid rgba(231, 76, 60, 0.6)',
                        color: '#ffcccc',
                        whiteSpace: 'nowrap',
                      }}
                      title="Abandonar Liga"
                    >
                      Salir de la liga
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Modal de Gestión de Miembros y Pagos */}
      {selectedGroupForMembers && (
        <GroupMembersModal
          groupId={selectedGroupForMembers.id}
          groupName={selectedGroupForMembers.name}
          currentJoinCode={selectedGroupForMembers.joinCode}
          initialRules={selectedGroupForMembers.rules || ''}
          imageUrl={selectedGroupForMembers.imageUrl || null}
          onUploadImage={async (blob) => {
            const url = await handleUploadGroupImage(selectedGroupForMembers.id, blob);
            setSelectedGroupForMembers((prev) => (prev ? { ...prev, imageUrl: url } : prev));
          }}
          onRemoveImage={async () => {
            await handleRemoveGroupImage(selectedGroupForMembers.id);
            setSelectedGroupForMembers((prev) => (prev ? { ...prev, imageUrl: null } : prev));
          }}
          isAdmin={
            (selectedGroupForMembers.adminUserId &&
              userId &&
              String(selectedGroupForMembers.adminUserId) === String(userId)) ||
            (selectedGroupForMembers.adminParticipantName &&
              userName &&
              selectedGroupForMembers.adminParticipantName.toLowerCase() === userName.toLowerCase())
          }
          currentUserId={userId}
          onClose={() => setSelectedGroupForMembers(null)}
          onCodeRegenerated={(newCode) => {
            setSelectedGroupForMembers((prev) => (prev ? { ...prev, joinCode: newCode } : prev));
          }}
          onSaveSettings={async ({ name, rules }) => {
            const ok = await handleSaveGroupConfig(selectedGroupForMembers.id, name, rules);
            if (ok) {
              setSelectedGroupForMembers((prev) => (prev ? { ...prev, name, rules } : prev));
            }
            return ok;
          }}
          onDelete={async () => {
            const ok = await handleDeleteGroup(
              selectedGroupForMembers.id,
              selectedGroupForMembers.name,
              { skipConfirm: true },
            );
            if (ok) setSelectedGroupForMembers(null);
            return ok;
          }}
        />
      )}

      {selectedGroupForRules && (
        <LeagueRulesModal
          group={selectedGroupForRules}
          onClose={() => setSelectedGroupForRules(null)}
        />
      )}
    </section>
  );
}
