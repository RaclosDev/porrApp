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

/** Mis ligas: crear, unirse con código y administrar. */
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
    groupsError,
    retryGroups,
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
    <div className="glass-panel invite-summary-card max-w-130 w-full mt-0 mb-6 mx-auto box-border rounded-[16px] p-5 flex flex-col gap-3 text-left bg-[linear-gradient(160deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.015))] bg-transparent border border-line shadow-[0_4px_14px_rgba(0,0,0,0.25)]">
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
        <span className="text-[0.72rem] font-semibold py-[3px] px-[9px] rounded-[999px] bg-[rgba(162,_155,_254,_0.14)] bg-none border border-[rgba(162,_155,_254,_0.35)] text-[#a29bfe]">
          {pendingInvite?.competitionName || 'Fútbol'}
        </span>
        <span className="text-[0.72rem] font-semibold py-[3px] px-[9px] rounded-[999px] bg-[rgba(0,_210,_211,_0.1)] bg-none border border-[rgba(0,_210,_211,_0.3)] text-[#00d2d3]">
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
          className={`w-full mt-0.5 border-none rounded-[10px] py-2.5 px-3.5 bg-[linear-gradient(135deg,_#00d2d3,_#00a8ff)] bg-transparent text-[#0f172a] font-extrabold text-[0.9rem] ${pendingInvite && !isJoiningInvite ? 'cursor-pointer' : '[cursor:wait]'} ${pendingInvite && !isJoiningInvite ? 'opacity-[1]' : 'opacity-[0.65]'}`}
          type="button"
          onClick={handleAcceptPendingInvite}
          disabled={!pendingInvite || isJoiningInvite}
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
            <h2 className="text-[1.5rem] mb-5">Inicia sesión para crear o unirte a una liga</h2>
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
          <h2 className="m-0 text-[1.6rem] text-white font-extrabold">Mis ligas</h2>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowJoinModal((prev) => !prev);
              setShowCreateModal(false);
            }}
            aria-expanded={showJoinModal}
            className="glass-btn py-2 px-4 text-[0.88rem] font-bold rounded-[10px] cursor-pointer"
          >
            Unirse con código
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreateModal((prev) => !prev);
              setShowJoinModal(false);
            }}
            aria-expanded={showCreateModal}
            className={`glass-btn py-2 px-4.5 text-[0.88rem] font-extrabold rounded-[10px] cursor-pointer ${showCreateModal ? '' : 'primary-btn'}`}
          >
            {showCreateModal ? 'Cancelar' : 'Crear liga'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[rgba(231,_76,_60,_0.2)] bg-none border border-[#e74c3c] text-[#ffcccc] p-[15px] rounded-[12px] mb-5 text-center">
          {error}
        </div>
      )}

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

      {showJoinModal && (
        <JoinGroupPanel
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          handleJoin={handleJoin}
          setShowJoinModal={setShowJoinModal}
        />
      )}

      {groupsError && (
        <div
          role="alert"
          className="bg-[rgba(231,_76,_60,_0.2)] bg-none border border-[#e74c3c] text-[#ffcccc] p-[15px] rounded-[12px] mb-5 text-center flex flex-col items-center gap-3"
        >
          <span>{groupsError}</span>
          <button
            type="button"
            onClick={retryGroups}
            className="glass-btn py-2 px-4 font-bold text-[0.9rem] rounded-[10px] cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted py-10 px-0">Cargando tus ligas...</div>
      ) : groupsError && groups.length === 0 ? null : groups.length === 0 ? (
        <div className="glass-panel text-center py-12 px-6 max-w-140 mt-5 mb-10 mx-auto rounded-[16px] border border-dashed border-[rgba(0,_210,_211,_0.4)] bg-[rgba(0,_210,_211,_0.04)] bg-none">
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
              className="glass-btn primary-btn py-[11px] px-5.5 font-extrabold text-[0.95rem]"
            >
              Crear mi primera liga
            </button>
            <button
              type="button"
              onClick={() => {
                setShowJoinModal(true);
                setShowCreateModal(false);
              }}
              className="glass-btn py-[11px] px-5 font-bold text-[0.95rem]"
            >
              Unirse con código
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
