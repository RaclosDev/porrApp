import PaperLoading from '../components/PaperLoading';
import { useState, useEffect } from 'react';
import GroupMembersModal from '../components/GroupMembersModal';
import LeagueRulesModal from '../components/LeagueRulesModal';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CredentialResponse } from '@react-oauth/google';
import AuthPanel from '../components/AuthPanel';
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { usePasskeyAutoSignIn } from '../hooks/usePasskeyAutoSignIn';
import { useGroupsDashboard } from '../hooks/useGroupsDashboard';
import GroupCard from '../components/groups/GroupCard';
import TrackerCard from '../components/tracker/TrackerCard';
import JoinGroupPanel from '../components/groups/JoinGroupPanel';
import CustomCompetitionEditor from '../components/groups/CustomCompetitionEditor';
import LeagueLockSection, { hasLeagueLockSetting } from '../components/groups/LeagueLockSection';
import LeagueMatchesSection, { hasMatchSelection } from '../components/groups/LeagueMatchesSection';
import { myTrackersQuery } from '../services/queries';
import { isScoreboardLeague } from '../utils/scoreboardLeague';
import type { Group } from '../types/api';
import { sortGroupsByRecent } from '../utils/groupOrder';

/** Mis ligas: crear, unirse con código y administrar. */
export default function GroupsDashboard() {
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<Group | null>(null);
  const [selectedGroupForRules, setSelectedGroupForRules] = useState<Group | null>(null);
  const [selectedCustomCompetition, setSelectedCustomCompetition] = useState<Group | null>(null);
  // Desde el selector de liga, «Unirse con código» llega abierto (?unirse); desde crear liga, tras
  // crear una con competición personalizada, su gestión (?gestionar=<id>).
  const [searchParams, setSearchParams] = useSearchParams();
  const [showJoinModal, setShowJoinModal] = useState(() => searchParams.has('unirse'));

  const {
    groups,
    summaries,
    loading,
    error,
    groupsError,
    retryGroups,
    joinCode,
    setJoinCode,
    handleJoin,
    handleSaveGroupConfig,
    handleUploadGroupImage,
    handleRemoveGroupImage,
    handleDeleteGroup,
    handleEnterGroup,
    handleRepeatGroup,
    handleLeaveGroup,
    handleCopyCode,
    handleCopyLink,
    handleShareWhatsApp,
    userName,
    userId,
    isAuthenticated,
    activeGroupId,
  } = useGroupsDashboard();

  // Los marcadores de juegos de mesa van en la misma lista que las ligas.
  const trackers = useQuery(myTrackersQuery(isAuthenticated));
  const trackerList = trackers.data ?? [];

  // ?unirse se consume al abrir el modal, para que el selector pueda volver a abrirlo estando ya aquí.
  useEffect(() => {
    if (!searchParams.has('unirse')) return;
    setShowJoinModal(true);
    setSearchParams(
      (params) => {
        params.delete('unirse');
        return params;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const manageId = searchParams.get('gestionar');
  const competitionToManage =
    selectedCustomCompetition ??
    groups.find((group) => group.customCompetition && String(group.id) === manageId) ??
    null;

  /** El nombre público puede repetirse; la administración pertenece al id de usuario. */
  const isGroupAdmin = (group: Group) =>
    Boolean(
      userId &&
      (String(group.adminUserId) === String(userId) ||
        group.adminUserIds?.some((id) => String(id) === String(userId))),
    );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowJoinModal(false);
        // El modal de administración gestiona su propio Escape para proteger cambios sin guardar.
        setSelectedGroupForRules(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const signInWithGoogle = useGoogleSignIn();
  const handleDirectGoogleLogin = async (credentialResponse: CredentialResponse) => {
    await signInWithGoogle(credentialResponse);
  };

  const appleSignIn = useAppleSignIn();
  const pendingCode = localStorage.getItem('pendingJoinCode');
  usePasskeyAutoSignIn(!userName && !pendingCode);
  if (pendingCode) return <Navigate to={`/join/${encodeURIComponent(pendingCode)}`} replace />;

  if (!userName) {
    return (
      <div className="join-auth-screen paper-panel album-sheet landing-tape text-center p-6">
        <AuthPanel
          intent="login"
          lede="Para crear una liga o unirte a la de tus amigos."
          onGoogleSuccess={handleDirectGoogleLogin}
          onApple={appleSignIn}
          shape="rectangular"
        />
      </div>
    );
  }

  return (
    <section className="view-section active">
      <div className="flex justify-between items-center flex-wrap gap-3.5 mb-6 pb-4 border-b border-b-[rgba(255,_255,_255,_0.08)]">
        <div>
          <h2 className="m-0 poster-title text-[1.8rem] text-white">Mis ligas</h2>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Link
            to="/torneos/nuevo"
            className="glass-btn py-2 px-4 font-bold inline-flex items-center min-h-11"
          >
            Organizar torneo
          </Link>
          <button
            type="button"
            onClick={() => setShowJoinModal((prev) => !prev)}
            aria-expanded={showJoinModal}
            className="glass-btn py-2 px-4 text-[0.88rem] font-bold rounded-[10px] cursor-pointer"
          >
            Unirse con código
          </button>
          <Link
            to="/crear-liga"
            className="glass-btn primary-btn py-2 px-4.5 text-[0.88rem] font-extrabold rounded-[10px] inline-flex items-center min-h-11"
          >
            Crear liga
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="paper-panel album-sheet border border-[var(--miss)] text-[var(--miss)] p-[15px] rounded-[4px] mb-5 text-center"
        >
          {error}
        </div>
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
          className="paper-panel album-sheet border border-[var(--miss)] text-[var(--miss)] p-[15px] rounded-[4px] mb-5 text-center flex flex-col items-center gap-3"
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

      {competitionToManage && isGroupAdmin(competitionToManage) && (
        <CustomCompetitionEditor
          group={competitionToManage}
          onClose={() => {
            setSelectedCustomCompetition(null);
            if (manageId) setSearchParams({}, { replace: true });
          }}
        />
      )}

      {loading ? (
        <PaperLoading label="Cargando tus ligas" />
      ) : groupsError && groups.length === 0 ? null : groups.length === 0 &&
        trackerList.length === 0 ? (
        <div className="paper-panel album-sheet text-center py-12 px-6 max-w-140 mt-5 mb-10 mx-auto">
          <h3 className="poster-title mt-0 mb-2 mx-0 text-[1.5rem]">
            Aún no te has unido a ninguna liga privada
          </h3>
          <p className="text-muted text-[0.92rem] max-w-105 mt-0 mb-6 mx-auto leading-[1.5]">
            Crea tu propia porra personalizada para competir con tus amigos o únete a una ya
            existente usando un código de invitación.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              to="/crear-liga"
              className="glass-btn primary-btn py-[11px] px-5.5 font-extrabold text-[0.95rem] inline-flex items-center min-h-11"
            >
              Crear mi primera liga
            </Link>
            <button
              type="button"
              onClick={() => setShowJoinModal(true)}
              className="glass-btn py-[11px] px-5 font-bold text-[0.95rem]"
            >
              Unirse con código
            </button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2 max-w-240 mx-auto my-0 p-0 list-none">
          {sortGroupsByRecent(
            // Las de juegos de mesa tienen su tarjeta, con jugadores y partidas.
            groups.filter((group) => !isScoreboardLeague(group)),
            activeGroupId,
          ).map((group) => {
            const isSelected = Boolean(activeGroupId) && activeGroupId === group.id.toString();
            const isCreator = String(group.adminUserId) === String(userId);
            return (
              <GroupCard
                key={group.id}
                group={group}
                summary={
                  group.kind === 'POKER' || group.kind === 'TOURNAMENT'
                    ? undefined
                    : summaries.get(group.id)
                }
                isSelected={isSelected}
                isCreator={isCreator}
                canAdminister={isGroupAdmin(group)}
                handleEnterGroup={handleEnterGroup}
                handleRepeatGroup={handleRepeatGroup}
                handleLeaveGroup={handleLeaveGroup}
                handleCopyCode={handleCopyCode}
                handleCopyLink={handleCopyLink}
                handleShareWhatsApp={handleShareWhatsApp}
                setSelectedGroupForMembers={setSelectedGroupForMembers}
                setSelectedGroupForRules={setSelectedGroupForRules}
                setSelectedCustomCompetition={setSelectedCustomCompetition}
              />
            );
          })}
          {trackerList.map((tracker) => (
            <TrackerCard
              key={`tracker-${tracker.id}`}
              tracker={tracker}
              isSelected={activeGroupId === String(tracker.id)}
              group={groups.find((group) => String(group.id) === String(tracker.id))}
              onShare={handleShareWhatsApp}
              onRules={setSelectedGroupForRules}
              onMembers={setSelectedGroupForMembers}
            />
          ))}
        </ul>
      )}

      {selectedGroupForMembers && (
        <GroupMembersModal
          key={selectedGroupForMembers.id}
          groupId={selectedGroupForMembers.id}
          groupName={selectedGroupForMembers.name}
          isTournament={selectedGroupForMembers.kind === 'TOURNAMENT'}
          currentJoinCode={selectedGroupForMembers.joinCode}
          initialRules={selectedGroupForMembers.rules || ''}
          imageUrl={selectedGroupForMembers.imageUrl || null}
          onUploadImage={async (blob) => {
            const url = await handleUploadGroupImage(selectedGroupForMembers.id, blob);
            setSelectedGroupForMembers((prev) =>
              prev?.id === selectedGroupForMembers.id ? { ...prev, imageUrl: url } : prev,
            );
          }}
          onRemoveImage={async () => {
            await handleRemoveGroupImage(selectedGroupForMembers.id);
            setSelectedGroupForMembers((prev) =>
              prev?.id === selectedGroupForMembers.id ? { ...prev, imageUrl: null } : prev,
            );
          }}
          isAdmin={isGroupAdmin(selectedGroupForMembers)}
          leagueKind={selectedGroupForMembers.kind}
          creatorUserId={selectedGroupForMembers.adminUserId}
          lockSection={
            <>
              {hasLeagueLockSetting(selectedGroupForMembers) && (
                <LeagueLockSection group={selectedGroupForMembers} />
              )}
              {isGroupAdmin(selectedGroupForMembers) &&
                hasMatchSelection(selectedGroupForMembers) && (
                  <LeagueMatchesSection group={selectedGroupForMembers} />
                )}
            </>
          }
          currentUserId={userId}
          onClose={() => setSelectedGroupForMembers(null)}
          onCodeRegenerated={(newCode) => {
            setSelectedGroupForMembers((prev) =>
              prev?.id === selectedGroupForMembers.id ? { ...prev, joinCode: newCode } : prev,
            );
          }}
          entryFee={
            selectedGroupForMembers.publicLeague || selectedGroupForMembers.kind === 'TOURNAMENT'
              ? undefined
              : Boolean(selectedGroupForMembers.entryFee)
          }
          onEntryFeeChanged={(entryFee) => {
            setSelectedGroupForMembers((prev) =>
              prev?.id === selectedGroupForMembers.id ? { ...prev, entryFee } : prev,
            );
          }}
          onSaveSettings={async ({ name, rules }) => {
            const ok = await handleSaveGroupConfig(selectedGroupForMembers.id, name, rules);
            if (ok) {
              setSelectedGroupForMembers((prev) =>
                prev?.id === selectedGroupForMembers.id ? { ...prev, name, rules } : prev,
              );
            }
            return ok;
          }}
          onDelete={async () => {
            const ok = await handleDeleteGroup(
              selectedGroupForMembers.id,
              selectedGroupForMembers.name,
              { skipConfirm: true },
            );
            if (ok)
              setSelectedGroupForMembers((prev) =>
                prev?.id === selectedGroupForMembers.id ? null : prev,
              );
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
