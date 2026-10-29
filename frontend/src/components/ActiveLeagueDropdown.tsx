import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { readGroupVisits } from '../store/useAppStore';
import { LeagueAvatar } from './Avatar';

function getCompetitionBadge(competitionName: string | null | undefined) {
  if (!competitionName) return '🏆';
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
  if (lower.includes('mundial') || lower.includes('world cup') || lower.includes('fifa'))
    return '🌍';
  return '🏆';
}

export default function ActiveLeagueDropdown() {
  const {
    activeGroupId,
    activeGroupName,
    activeCompetitionName,
    activeCompetitionFormatType,
    userGroups,
    changeGroup,
    isAuthenticated,
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // La liga activa primero y, después, las visitadas más recientemente.
  const sortedGroups = useMemo(() => {
    const visits = readGroupVisits();
    return [...(userGroups || [])].sort((a, b) => {
      const aSelected = String(a.id) === String(activeGroupId);
      const bSelected = String(b.id) === String(activeGroupId);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;

      const aVisited = Number(visits[a.id]) || 0;
      const bVisited = Number(visits[b.id]) || 0;
      if (aVisited !== bVisited) return bVisited - aVisited;

      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [userGroups, activeGroupId]);

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

  if (isAuthenticated && (!userGroups || userGroups.length === 0)) {
    return (
      <button
        type="button"
        id="btn-active-league-dropdown"
        onClick={() => navigate('/mis-ligas')}
        className="glass-btn flex items-center gap-1.5 py-1 px-2.5 min-h-8.5 rounded-[16px] border border-dashed border-[rgba(0,_210,_211,_0.6)] bg-[rgba(0,_210,_211,_0.1)] bg-none text-[#00d2d3] cursor-pointer text-[0.82rem] font-bold"
        title="Crear o unirse a una liga"
      >
        <span>➕</span>
        <span className="max-w-32.5 overflow-hidden text-ellipsis whitespace-nowrap">
          Crear o unirse
        </span>
      </button>
    );
  }

  const currentBadge = getCompetitionBadge(activeCompetitionName);
  const activeGroup = (userGroups || []).find((g) => String(g.id) === String(activeGroupId));
  const activeImageUrl = activeGroup?.imageUrl || null;
  const displayLeagueName = activeGroupName || 'Porra Global';
  const displayCompName =
    activeCompetitionName || (activeCompetitionFormatType === 'LEAGUE' ? 'Liga' : 'Mundial');

  return (
    <div className="relative inline-flex items-center z-[105]" ref={dropdownRef}>
      <button
        type="button"
        id="btn-active-league-dropdown"
        onClick={() => setIsOpen(!isOpen)}
        className={`glass-btn flex items-center gap-2 py-1.5 px-3 min-h-9.5 rounded-[10px] border border-[rgba(0,_210,_211,_0.4)] text-main cursor-pointer font-semibold text-[0.88rem] [transition:all_0.2s_ease] ${isOpen ? 'bg-[rgba(0,_210,_211,_0.15)] bg-none' : 'bg-[rgba(15,_23,_42,_0.75)] bg-none'} ${isOpen ? 'shadow-[0_0_15px_rgba(0,_210,_211,_0.25)]' : 'shadow-none'}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Cambiar de liga o peña"
      >
        <LeagueAvatar url={activeImageUrl} badge={currentBadge} size={26} />
        <div className="flex flex-col items-start text-left leading-[1.15]">
          <span className="max-w-35 overflow-hidden text-ellipsis whitespace-nowrap text-white">
            {displayLeagueName}
          </span>
          <span className="text-[0.7rem] text-accent font-medium max-w-32.5 overflow-hidden text-ellipsis whitespace-nowrap">
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
        <div
          role="menu"
          className="active-league-menu absolute top-[calc(100%_+_8px)] bg-[#111827] bg-none border border-[rgba(0,_210,_211,_0.35)] rounded-[12px] shadow-[0_16px_36px_rgba(0,_0,_0,_0.75),_0_0_20px_rgba(0,_210,_211,_0.15)] [backdrop-filter:blur(12px)] p-2 flex flex-col gap-1 [animation:fadeIn_0.15s_ease-out]"
        >
          <div className="py-1.5 px-2.5 text-[0.75rem] font-bold tracking-[0.5px] text-muted uppercase border-b border-b-[rgba(255,_255,_255,_0.08)] mb-1 flex justify-between items-center">
            <span>Mis Ligas</span>
            <span className="text-[0.7rem] text-[#00d2d3]">
              {userGroups?.length || 0} {userGroups?.length === 1 ? 'liga' : 'ligas'}
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto flex flex-col gap-[3px]">
            {sortedGroups.length > 0 ? (
              sortedGroups.map((g) => {
                const isSelected = activeGroupId && String(activeGroupId) === String(g.id);
                const gBadge = getCompetitionBadge(g.competitionName);
                return (
                  <button
                    className={`flex items-center justify-between gap-2.5 py-2 px-2.5 rounded-[8px] cursor-pointer text-left [transition:background_0.15s_ease] w-full ${isSelected ? 'border border-[rgba(0,_210,_211,_0.4)]' : 'border border-transparent'} ${isSelected ? 'bg-[rgba(0,_210,_211,_0.12)] bg-none' : 'bg-transparent bg-none'} ${isSelected ? 'text-[#00d2d3]' : 'text-white'}`}
                    key={g.id}
                    type="button"
                    onClick={() => {
                      changeGroup(g.id.toString());
                      setIsOpen(false);
                      navigate('/');
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <LeagueAvatar url={g.imageUrl} badge={gBadge} size={30} />
                      <div className="min-w-0 flex flex-col">
                        <span
                          className={`text-[0.88rem] overflow-hidden text-ellipsis whitespace-nowrap ${isSelected ? 'font-bold' : 'font-medium'}`}
                        >
                          {g.name}
                        </span>
                        <span className="text-[0.72rem] text-muted">
                          {g.competitionName || 'Mundial'} ·{' '}
                          {g.poolFormat === 'MATCH_DAY' ? 'Jornadas' : 'Cuadro'}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[#00d2d3] font-bold text-[0.9rem]">✓</span>
                    )}
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
          </div>

          <div className="border-t border-t-[rgba(255,_255,_255,_0.08)] pt-1.5 mt-1">
            <button
              className="w-full py-2 px-2.5 rounded-[8px] border border-dashed border-[rgba(0,_210,_211,_0.35)] bg-[rgba(0,_210,_211,_0.05)] bg-none text-[#00d2d3] text-[0.82rem] font-semibold cursor-pointer flex items-center justify-center gap-1.5 [transition:all_0.15s_ease]"
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/mis-ligas');
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 210, 211, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 210, 211, 0.05)';
              }}
            >
              <span>➕</span>
              <span>Crear o Unirse a una Liga</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
