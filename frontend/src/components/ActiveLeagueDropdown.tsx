import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dices } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { sortGroupsByRecent } from '../utils/groupOrder';
import { confirmAction } from '../utils/confirmAction';
import {
  discardUnsavedChanges,
  leaveDialog,
  unsavedChangesMessage,
  useUnsavedChangesStore,
} from '../utils/unsavedChanges';
import { LeagueAvatar } from './Avatar';
import { competitionLabel, poolFormatShortLabel } from '../utils/poolFormat';
import { myTrackersQuery } from '../services/queries';
import { scoreboardPath } from '../utils/scoreboardLeague';

/** Bandera del país de la competición; sin país conocido, la liga muestra su monograma. */
function getCompetitionBadge(competitionName: string | null | undefined) {
  if (!competitionName) return null;
  const lower = competitionName.toLowerCase();
  if (lower.includes('laliga') || lower.includes('copa del rey') || lower.includes('españa'))
    return '🇪🇸';
  if (lower.includes('premier') || lower.includes('inglaterra')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (lower.includes('champions') || lower.includes('europa') || lower.includes('conference'))
    return '🇪🇺';
  if (lower.includes('serie a') || lower.includes('italia')) return '🇮🇹';
  if (lower.includes('bundesliga') || lower.includes('alemania')) return '🇩🇪';
  if (lower.includes('ligue 1') || lower.includes('francia')) return '🇫🇷';
  if (lower.includes('mex') || lower.includes('bbva')) return '🇲🇽';
  if (lower.includes('mls') || lower.includes('usa')) return '🇺🇸';
  return null;
}

export default function ActiveLeagueDropdown() {
  const {
    activeGroupId,
    activeGroupName,
    activeCompetitionName,
    activeGroupMultiCompetition,
    userGroups,
    changeGroup,
    isAuthenticated,
    userGroupsLoaded,
    choosingLeague,
  } = useAppContext();

  // Las ligas de juegos de mesa salen en la lista, pero no son la liga activa: abren su marcador.
  const { data: scoreboards = [], isPending: scoreboardsPending } = useQuery(
    myTrackersQuery(isAuthenticated),
  );
  const leagueCount = (userGroups?.length || 0) + scoreboards.length;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // La liga activa primero y, después, las visitadas más recientemente.
  const sortedGroups = useMemo(
    () => sortGroupsByRecent(userGroups || [], activeGroupId),
    [userGroups, activeGroupId],
  );

  /**
   * Cambiar de liga no es una navegación que `LeaveGuard` pueda retener: con cambios de predicción
   * sin guardar se pregunta antes de cambiar. En la misma liga solo se va al inicio, y ahí sí avisa.
   */
  const selectLeague = (groupId: string) => {
    const goToLeague = () => {
      changeGroup(groupId);
      navigate('/');
    };
    const message = unsavedChangesMessage(useUnsavedChangesStore.getState());
    if (message === null || groupId === String(activeGroupId)) {
      goToLeague();
      return;
    }
    void confirmAction(leaveDialog(message)).then((leave) => {
      if (!leave) return;
      // Ya confirmado: que la navegación al inicio no vuelva a preguntar.
      discardUnsavedChanges();
      goToLeague();
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Mientras llegan las ligas o se elige cuál abrir, «Crear o unirse» o «Ninguna liga» asomarían
  // un instante antes del selector.
  const onlyScoreboardsUnknown = !userGroups?.length && scoreboardsPending;
  if (isAuthenticated && (!userGroupsLoaded || choosingLeague || onlyScoreboardsUnknown)) {
    return <span className="chrome-placeholder w-50 h-11" aria-hidden="true" />;
  }

  // Sin ligas va a Mis ligas, que ofrece crear y unirse; el asistente de crear liga solo crea.
  if (isAuthenticated && leagueCount === 0) {
    return (
      <button
        type="button"
        id="btn-active-league-dropdown"
        onClick={() => navigate('/mis-ligas')}
        className="glass-btn flex items-center gap-1.5 py-1 px-2.5 min-h-11 rounded-[10px] border-dashed cursor-pointer text-[0.82rem]"
        title="Crear o unirse a una liga"
      >
        <span className="max-w-32.5 overflow-hidden text-ellipsis whitespace-nowrap">
          Crear o unirse
        </span>
      </button>
    );
  }

  const currentBadge = getCompetitionBadge(activeCompetitionName);
  const activeGroup = (userGroups || []).find((g) => String(g.id) === String(activeGroupId));
  const activeImageUrl = activeGroup?.imageUrl || null;
  const displayLeagueName = activeGroupName || 'Liga';
  // Solo la competición real de la liga: sin liga (o sin dato) no se supone ninguna.
  const displayCompName = !activeGroupId
    ? 'Elige una de tus ligas'
    : activeGroupMultiCompetition
      ? 'Varias competiciones'
      : activeCompetitionName || '';

  return (
    <div className="relative inline-flex items-center z-[105]" ref={dropdownRef}>
      <button
        type="button"
        id="btn-active-league-dropdown"
        onClick={() => setIsOpen(!isOpen)}
        className="glass-btn flex items-center gap-2 py-1.5 px-3 min-h-11 rounded-[10px] cursor-pointer normal-case tracking-normal font-[Inter,sans-serif] font-semibold text-[0.88rem]"
        aria-expanded={isOpen}
        title={`Cambiar de liga (${[displayLeagueName, displayCompName].filter(Boolean).join(' · ')})`}
      >
        <LeagueAvatar
          url={activeImageUrl}
          badge={currentBadge}
          name={displayLeagueName}
          size={26}
        />
        <div
          key={activeGroupId}
          className="league-selection flex flex-col items-start text-left leading-[1.15] min-w-0"
        >
          <span className="poster-title w-full max-w-35 lg:max-w-60 overflow-hidden text-ellipsis whitespace-nowrap text-main text-[0.95rem] tracking-[0.02em]">
            {displayLeagueName}
          </span>
          <span className="w-full text-[0.7rem] text-muted font-medium max-w-32.5 lg:max-w-60 overflow-hidden text-ellipsis whitespace-nowrap">
            {displayCompName}
          </span>
        </div>
        <span
          className={`text-[0.75rem] text-muted [transition:transform_0.2s_ease] ml-0.5 ${isOpen ? '[transform:rotate(180deg)]' : '[transform:none]'}`}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="active-league-menu paper-panel absolute top-[calc(100%_+_8px)] rounded-[6px] shadow-[0_16px_36px_rgba(0,_0,_0,_0.6)] p-2 flex flex-col gap-1">
          <div className="poster-title py-1.5 px-2.5 text-[0.8rem] text-muted border-b border-b-line mb-1 flex justify-between items-center">
            <span>Mis Ligas</span>
            <span className="text-[0.7rem] text-muted normal-case font-[Inter,sans-serif] tracking-normal">
              {leagueCount} {leagueCount === 1 ? 'liga' : 'ligas'}
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto flex flex-col gap-[3px]">
            {scoreboards.length > 0 || sortedGroups.length > 0 ? (
              sortedGroups.map((g) => {
                const isSelected = activeGroupId && String(activeGroupId) === String(g.id);
                const gBadge = g.multiCompetition ? null : getCompetitionBadge(g.competitionName);
                return (
                  <button
                    className={`flex items-center justify-between gap-2.5 py-2 px-2.5 rounded-[8px] cursor-pointer text-left [transition:background_0.15s_ease] w-full ${isSelected ? 'border border-[var(--ink)]' : 'border border-transparent'} ${isSelected ? 'bg-[rgba(17,_24,_39,_0.06)] bg-none' : 'bg-transparent bg-none hover:bg-[rgba(17,_24,_39,_0.06)] focus-visible:bg-[rgba(17,_24,_39,_0.06)]'} text-main`}
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      selectLeague(g.id.toString());
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <LeagueAvatar url={g.imageUrl} badge={gBadge} name={g.name} size={30} />
                      <div className="min-w-0 flex flex-col">
                        <span
                          className={`text-[0.88rem] overflow-hidden text-ellipsis whitespace-nowrap ${isSelected ? 'font-bold' : 'font-medium'}`}
                        >
                          {g.name}
                        </span>
                        <span className="text-[0.72rem] text-muted">
                          {[
                            competitionLabel(g),
                            // Terminada, la temporada la distingue de la liga que la repite.
                            g.seasonEnded ? `${g.season ?? 'Temporada'} terminada` : null,
                            poolFormatShortLabel(g.poolFormat),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                    </div>
                    {isSelected && <span className="marker-ink text-[1rem]">✓</span>}
                  </button>
                );
              })
            ) : (
              <div className="py-3 px-2.5 text-center text-muted text-[0.8rem]">
                {isAuthenticated
                  ? 'No te has unido a ninguna liga privada todavía.'
                  : 'Inicia sesión para unirte o ver tus ligas.'}
              </div>
            )}
            {scoreboards.map((scoreboard) => (
              <button
                className="flex items-center gap-2 py-2 px-2.5 rounded-[8px] cursor-pointer text-left [transition:background_0.15s_ease] w-full border border-transparent bg-transparent bg-none hover:bg-[rgba(17,_24,_39,_0.06)] focus-visible:bg-[rgba(17,_24,_39,_0.06)] text-main"
                key={`scoreboard-${scoreboard.id}`}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate(scoreboardPath(scoreboard.id));
                }}
              >
                <span
                  className="shrink-0 size-[30px] inline-flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Dices size={22} />
                </span>
                <span className="min-w-0 flex flex-col">
                  <span className="text-[0.88rem] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                    {scoreboard.name}
                  </span>
                  <span className="text-[0.72rem] text-muted">Juego de mesa</span>
                </span>
              </button>
            ))}
          </div>

          {/* Sin sesión, Mis ligas pide iniciarla antes de crear o unirse. */}
          <div className="border-t border-t-line pt-1.5 mt-1 grid grid-cols-2 gap-1.5">
            {[
              { label: 'Crear liga', to: isAuthenticated ? '/crear-liga' : '/mis-ligas' },
              {
                label: 'Unirse con código',
                to: isAuthenticated ? '/mis-ligas?unirse' : '/mis-ligas',
              },
            ].map(({ label, to }) => (
              <button
                key={label}
                className="glass-btn py-2 px-2.5 rounded-[8px] border-dashed text-[0.82rem] cursor-pointer flex items-center justify-center"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate(to);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
