import toast from 'react-hot-toast';
import { useState } from 'react';
import GroupMembersModal from '../components/GroupMembersModal';
import { GoogleLogin } from '@react-oauth/google';
import { POOL_FORMATS, PRESET_TEMPLATES, useGroupsDashboard } from '../hooks/useGroupsDashboard';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setShowJoinModal(false);
        setSelectedGroupForMembers(null);
        setNewlyCreatedGroup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    selectedTemplate,
    selectTemplate,
    wizardStep,
    setWizardStep,
    newlyCreatedGroup,
    setNewlyCreatedGroup,
    pendingJoinCodeNotice,
    joinCode,
    setJoinCode,
    visibleCodes,
    toggleCodeVisibility,
    isCreating,
    handleCreate,
    handleJoin,
    handleEditGroup,
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

  if (!userName) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
        {pendingJoinCodeNotice && (
          <div
            style={{
              maxWidth: '500px',
              margin: '0 auto 24px',
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'rgba(0, 210, 211, 0.15)',
              border: '1px solid #00d2d3',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>🎟️ Invitación Detectada</div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>
              Has recibido una invitación para unirte con el código:
            </p>
            <div
              style={{
                fontSize: '1.6rem',
                fontWeight: '900',
                letterSpacing: '4px',
                color: '#00d2d3',
                marginBottom: '10px',
              }}
            >
              {pendingJoinCodeNotice}
            </div>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Inicia sesión directamente para unirte automáticamente a la liga:
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
          </div>
        )}

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
      </div>
    );
  }

  const activeTemplateObj = PRESET_TEMPLATES.find((t) => t.id === selectedTemplate);

  return (
    <section className="view-section active">
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
                    navigate('/bracket');
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
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.6rem', color: '#fff', fontWeight: 800 }}>
            Mis Ligas
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Compite con amigos en tus propias porras privadas o únete con un código.
          </p>
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
                🏆 Asistente de Creación de Liga
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      background:
                        wizardStep === 1 ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                      color: wizardStep === 1 ? '#0f172a' : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    1. Configuración
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      background:
                        wizardStep === 2 ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                      color: wizardStep === 2 ? '#0f172a' : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    2. Vista Previa Reglas
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  aria-label="Cerrar Asistente"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    marginLeft: '6px',
                    minWidth: '44px',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Cerrar Asistente"
                >
                  ✕
                </button>
              </div>
            </div>

            {wizardStep === 1 ? (
              <div>
                {/* Plantillas recomendadas */}
                <div style={{ marginBottom: '14px' }}>
                  <div
                    style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}
                  >
                    Elige una plantilla lista para usar:
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {PRESET_TEMPLATES.map((tmpl) => {
                      const isChosen = selectedTemplate === tmpl.id;
                      return (
                        <div
                          key={tmpl.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => selectTemplate(tmpl.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectTemplate(tmpl.id);
                            }
                          }}
                          style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: isChosen
                              ? '2px solid #00d2d3'
                              : '1px solid rgba(255,255,255,0.1)',
                            background: isChosen ? 'rgba(0, 210, 211, 0.12)' : 'rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: '1.3rem' }}>{tmpl.icon}</span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isChosen ? '#00d2d3' : 'rgba(255,255,255,0.1)',
                                color: isChosen ? '#0f172a' : 'var(--text-muted)',
                                fontWeight: 'bold',
                              }}
                            >
                              {tmpl.badge}
                            </span>
                          </div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white' }}>
                            {tmpl.name}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              lineHeight: '1.2',
                            }}
                          >
                            {tmpl.tagline}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Formulario de parámetros */}
                <form
                  onSubmit={handleCreate}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
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

                  <div
                    style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}
                  >
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="glass-btn"
                      style={{ flex: 1, padding: '10px' }}
                    >
                      👁️ Ver Reglas y Puntuación
                    </button>
                    <button
                      type="submit"
                      className="glass-btn primary-btn"
                      style={{ flex: 1, padding: '10px', fontWeight: 'bold' }}
                    >
                      🚀 Crear Liga Ahora
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                {/* Paso 2: Vista previa explicativa de reglas */}
                <div
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 'bold',
                      color: '#00d2d3',
                      marginBottom: '8px',
                      fontSize: '1rem',
                    }}
                  >
                    {activeTemplateObj?.name || 'Formato Seleccionado'}
                  </div>
                  <p style={{ color: 'white', fontSize: '0.85rem', margin: '0 0 12px 0' }}>
                    {activeTemplateObj?.description ||
                      'Formato configurado según tus preferencias.'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>⏱️</span>
                      <span>
                        <strong>Cierre de pronósticos:</strong> Cada partido bloquea su edición de
                        forma independiente exactamente a la hora del pitido inicial.
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>📊</span>
                      <span>
                        <strong>Puntuación explicable:</strong> Clasificación en vivo tras cada
                        partido con desglose público y 100% lúdico (sin dinero ni apuestas).
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>🔗</span>
                      <span>
                        <strong>Invitaciones seguras:</strong> Código de 6 letras y enlace directo
                        con 1-clic para compartir por WhatsApp.
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="glass-btn"
                    style={{ flex: 1, padding: '10px' }}
                  >
                    ⬅️ Volver a Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="glass-btn primary-btn"
                    style={{ flex: 1, padding: '10px', fontWeight: 'bold' }}
                  >
                    {isCreating ? '⏳ Creando Liga...' : '🚀 Confirmar y Crear Liga'}
                  </button>
                </div>
              </div>
            )}
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
            const isCodeVisible = visibleCodes.has(group.id);
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
                  border: isSelected ? '2px solid #00d2d3' : '1px solid var(--border-color)',
                  boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.4)' : 'none',
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

                {/* Código de Invitación y Acciones Rápidas */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    alignItems: 'flex-end',
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Mostrar u ocultar código"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCodeVisibility(group.id);
                      }
                    }}
                    onClick={() => toggleCodeVisibility(group.id)}
                    style={{
                      fontSize: '0.8rem',
                      background: 'rgba(0,0,0,0.5)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title="Click para mostrar/ocultar código"
                  >
                    Código:{' '}
                    <strong
                      style={{ color: 'white', letterSpacing: isCodeVisible ? 'normal' : '2px' }}
                    >
                      {isCodeVisible ? group.joinCode : '••••••'}
                    </strong>
                    <span>{isCodeVisible ? '🙈' : '👁️'}</span>
                  </div>

                  {isCodeVisible && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleCopyCode(group.joinCode)}
                        className="glass-btn"
                        style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                        title="Copiar Código"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleCopyLink(group.joinCode)}
                        className="glass-btn"
                        style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                        title="Copiar Enlace de Invitación"
                      >
                        🔗
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(group)}
                        className="glass-btn"
                        style={{ padding: '2px 6px', fontSize: '0.75rem', color: '#25D366' }}
                        title="Compartir por WhatsApp"
                      >
                        💬
                      </button>
                    </div>
                  )}
                </div>

                <h3 style={{ fontSize: '1.2rem', margin: '0 0 6px 0', paddingRight: '120px' }}>
                  {group.name}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Admin: <strong>{group.adminParticipantName}</strong>
                </p>
                {group.competitionName && (
                  <p style={{ color: '#a29bfe', fontSize: '0.85rem', margin: '2px 0' }}>
                    {group.competitionName} ·{' '}
                    {group.poolFormat === 'MATCH_DAY'
                      ? 'Por Jornadas'
                      : group.betMode === 'FULL_BRACKET'
                        ? 'Completa'
                        : 'Bracket'}
                    <span
                      style={{ color: group.pichichi !== false ? '#00b894' : 'var(--text-muted)' }}
                    >
                      {' '}
                      · {group.pichichi !== false ? '🗒️ Pichichi' : 'Sin Pichichi'}
                    </span>
                  </p>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={() => handleEnterGroup(group.id)}
                    className="glass-btn primary-btn"
                    style={{
                      flex: 1,
                      background: isSelected ? 'rgba(0, 210, 211, 0.2)' : '',
                      border: isSelected ? '1px solid #00d2d3' : '',
                    }}
                    disabled={isSelected}
                  >
                    {isSelected ? 'Liga Actual' : 'Acceder'}
                  </button>

                  <button
                    onClick={() => handleShareWhatsApp(group)}
                    className="glass-btn"
                    style={{ padding: '8px 12px', fontSize: '0.9rem', color: '#25D366' }}
                    title="Compartir Liga en WhatsApp"
                    aria-label="Compartir Liga en WhatsApp"
                  >
                    💬 WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedGroupForMembers(group)}
                    className="glass-btn"
                    style={{ padding: '8px 12px', fontSize: '0.9rem', color: '#00d2d3' }}
                    title="Ver y Gestionar Participantes"
                    aria-label="Ver y Gestionar Participantes"
                  >
                    👥 Miembros
                  </button>

                  {isCreator ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleEditGroup(group.id, group.name)}
                        className="glass-btn"
                        style={{ padding: '8px', fontSize: '0.9rem' }}
                        title="Editar Nombre"
                        aria-label="Editar Nombre de la liga"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="glass-btn"
                        style={{
                          padding: '8px',
                          fontSize: '0.9rem',
                          background: 'rgba(231, 76, 60, 0.2)',
                          border: '1px solid #e74c3c',
                        }}
                        title="Borrar Liga"
                        aria-label="Borrar Liga"
                      >
                        🗑️
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleLeaveGroup(group.id, group.name)}
                      className="glass-btn"
                      style={{
                        background: 'rgba(231, 76, 60, 0.2)',
                        border: '1px solid #e74c3c',
                        color: '#ffcccc',
                      }}
                      title="Abandonar Liga"
                    >
                      Salir
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
          isAdmin={selectedGroupForMembers.adminUserId?.toString() === userId?.toString()}
          onClose={() => setSelectedGroupForMembers(null)}
          onCodeRegenerated={(newCode) => {
            selectedGroupForMembers.joinCode = newCode;
          }}
        />
      )}
    </section>
  );
}
