import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import GroupMembersModal from '../components/GroupMembersModal';
import LeagueRulesModal from '../components/LeagueRulesModal';
import { LeagueAvatar } from '../components/Avatar';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { useGroupsDashboard } from '../hooks/useGroupsDashboard';
import GroupCard from '../components/groups/GroupCard';
import JoinGroupPanel from '../components/groups/JoinGroupPanel';
import CreateLeagueWizard from '../components/groups/CreateLeagueWizard';
import CreatedLeagueModal from '../components/groups/CreatedLeagueModal';
import type { Group } from '../types/api';

/**
 * Vista del listado y gestión de grupos/ligas disponibles.
 * Permite buscar, crear o unirse a ligas con contraseñas,
 * además de administrar las propias en caso de ser el administrador.
 *
 * @component
 * @returns {JSX.Element} Vista del dashboard de grupos.
 */
export default function GroupsDashboard() {
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<Group | null>(null);
  const [selectedGroupForRules, setSelectedGroupForRules] = useState<Group | null>(null);
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
    selectedPoolFormat,
    setSelectedPoolFormat,
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

  /** El usuario administra la liga (por id o, en ligas antiguas, por nombre). */
  const isGroupAdmin = (group: Group) =>
    Boolean(
      (group.adminUserId && userId && String(group.adminUserId) === String(userId)) ||
      (group.adminParticipantName &&
        userName &&
        group.adminParticipantName.toLowerCase() === userName.toLowerCase()),
    );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const signInWithGoogle = useGoogleSignIn();
  const handleDirectGoogleLogin = async (credentialResponse: CredentialResponse) => {
    // Recarga para que el resto de la página se monte ya con la sesión.
    if (await signInWithGoogle(credentialResponse)) window.location.reload();
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
      <div className="flex items-center gap-3.5 min-h-16">
        {pendingInvite?.imageUrl ? (
          <img
            className="block w-16 h-16 flex-[0_0_64px] rounded-[12px] object-cover"
            src={pendingInvite.imageUrl}
            alt={pendingInvite.name ? `Imagen de ${pendingInvite.name}` : 'Imagen de la liga'}
          />
        ) : (
          <LeagueAvatar url={null} size={64} />
        )}
        <div className="min-w-0 flex-[1_1_auto]">
          <h2
            className="text-[1.15rem] leading-[1.2] mt-0 mb-1 mx-0 text-[color:var(--text-primary,_#fff)] overflow-hidden text-ellipsis whitespace-nowrap"
            title={pendingInvite?.name || 'Cargando liga…'}
          >
            {pendingInvite?.name || 'Cargando liga…'}
          </h2>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
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
        <div className="flex justify-center mt-0.5">
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
            <h2 className="text-[1.5rem] mb-[15px]">Debes iniciar sesión con Google</h2>
            <p className="text-muted mb-5">
              Para crear o unirte a una liga, necesitas acceder con tu cuenta de Google:
            </p>
            <div className="flex justify-center">
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
        <CreatedLeagueModal
          newlyCreatedGroup={newlyCreatedGroup}
          setNewlyCreatedGroup={setNewlyCreatedGroup}
          handleCopyCode={handleCopyCode}
          handleCopyLink={handleCopyLink}
          handleShareWhatsApp={handleShareWhatsApp}
          navigate={navigate}
        />
      )}

      <div className="flex justify-between items-center flex-wrap gap-3.5 mb-6 pb-4 border-b border-b-[rgba(255,_255,_255,_0.08)]">
        <div>
          <h2 className="m-0 text-[1.6rem] text-white font-extrabold">Mis Ligas</h2>
        </div>
        <div className="flex gap-2.5 flex-wrap">
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
        <div className="bg-[rgba(231,_76,_60,_0.2)] border border-[#e74c3c] text-[#ffcccc] p-[15px] rounded-[12px] mb-5 text-center">
          {error}
        </div>
      )}

      {/* Asistente de Creación de Liga */}
      {showCreateModal && (
        <CreateLeagueWizard
          competitions={competitions}
          newGroupName={newGroupName}
          setNewGroupName={setNewGroupName}
          selectedCompetition={selectedCompetition}
          setSelectedCompetition={setSelectedCompetition}
          selectedPoolFormat={selectedPoolFormat}
          setSelectedPoolFormat={setSelectedPoolFormat}
          includePichichi={includePichichi}
          setIncludePichichi={setIncludePichichi}
          isCreating={isCreating}
          handleCreate={handleCreate}
          setShowCreateModal={setShowCreateModal}
        />
      )}

      {/* Unirse con Código */}
      {showJoinModal && (
        <JoinGroupPanel
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          handleJoin={handleJoin}
          setShowJoinModal={setShowJoinModal}
        />
      )}

      {loading ? (
        <div className="text-center text-muted py-10 px-0">Cargando tus ligas...</div>
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
          <div className="text-[3rem] mb-3">🏟️</div>
          <h3 className="text-white mt-0 mb-2 mx-0 text-[1.3rem] font-extrabold">
            Aún no te has unido a ninguna liga privada
          </h3>
          <p className="text-muted text-[0.92rem] max-w-105 mt-0 mb-6 mx-auto leading-[1.5]">
            Crea tu propia porra personalizada para competir con tus amigos o únete a una ya
            existente usando un código de invitación.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setShowJoinModal(false);
              }}
              className="glass-btn primary-btn py-[11px] px-5.5 font-extrabold text-[0.95rem] bg-[linear-gradient(135deg,_#00d2d3,_#00a8ff)] text-[#0f172a] shadow-[0_4px_15px_rgba(0,_210,_211,_0.3)]"
            >
              ➕ Crear mi primera liga
            </button>
            <button
              type="button"
              onClick={() => {
                setShowJoinModal(true);
                setShowCreateModal(false);
              }}
              className="glass-btn py-[11px] px-5 font-bold text-[0.95rem]"
            >
              🎟️ Unirse con código
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-[15px] flex-wrap justify-center">
          {groups.map((group) => {
            const isSelected = Boolean(activeGroupId) && activeGroupId === group.id.toString();
            const isCreator = isGroupAdmin(group);
            return (
              <GroupCard
                key={group.id}
                group={group}
                isSelected={isSelected}
                isCreator={isCreator}
                handleEnterGroup={handleEnterGroup}
                handleLeaveGroup={handleLeaveGroup}
                handleCopyCode={handleCopyCode}
                handleCopyLink={handleCopyLink}
                handleShareWhatsApp={handleShareWhatsApp}
                setSelectedGroupForMembers={setSelectedGroupForMembers}
                setSelectedGroupForRules={setSelectedGroupForRules}
              />
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
          isAdmin={isGroupAdmin(selectedGroupForMembers)}
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
