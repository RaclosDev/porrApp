import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import Flag from '../components/Flag';
import { useSearchStats } from '../hooks/useSearchStats';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { UserAvatar } from '../components/Avatar';

const searchConditions = [
  { val: 'passes_groups', label: 'Pasa a 1/16', icon: '✅' },
  { val: 'first_group', label: 'Pasa como 1º', icon: '1️⃣' },
  { val: 'second_group', label: 'Pasa como 2º', icon: '2️⃣' },
  { val: 'passes_as_third', label: 'Pasa como 3º', icon: '🥉' },
  { val: 'reaches_r16', label: 'Llega a Octavos', icon: '⚽' },
  { val: 'reaches_qf', label: 'Llega a Cuartos', icon: '🔥' },
  { val: 'reaches_sf', label: 'Llega a Semis', icon: '💫' },
  { val: 'reaches_final', label: 'Llega a la Final', icon: '⚔️' },
  { val: 'is_champion', label: 'Es Campeón', icon: '🏆' },
  { val: 'eliminated_groups', label: 'Cae en Grupos', icon: '❌' },
];

/** Opción del desplegable: un texto o un valor con etiqueta e icono. */
type DropdownOption = string | { val: string; label: string; icon?: string };

const optionValue = (o: DropdownOption) => (typeof o === 'string' ? o : o.val);
const optionLabel = (o: DropdownOption) => (typeof o === 'string' ? o : o.label);
const optionIcon = (o: DropdownOption | undefined) =>
  o && typeof o !== 'string' ? o.icon : undefined;

/** Menú desplegable con buscador integrado; `withFlags` muestra banderas para países. */
function CustomDropdown({
  value,
  onChange,
  options,
  placeholder,
  withFlags = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder: string;
  withFlags?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => optionValue(o) === value);
  const displayLabel = selectedOption ? optionLabel(selectedOption) : '';
  const displayIcon = !searchTerm && optionIcon(selectedOption);

  const filteredOptions = options.filter((opt) =>
    optionLabel(opt).toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="relative w-full max-w-100" ref={dropdownRef}>
      <div
        className={`w-full py-[15px] px-5 bg-[rgba(20,20,35,0.9)] bg-none flex items-center justify-between [cursor:text] [transition:all_0.2s] ${isOpen ? 'shadow-[0_4px_12px_rgba(0,0,0,0.4)]' : 'shadow-none'}`}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          borderRadius: '12px',
          border: `1px solid ${isOpen ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)'}`,
        }}
      >
        <div className="flex items-center gap-2.5 grow">
          {displayIcon && <span>{displayIcon}</span>}
          {!searchTerm && withFlags && value && (
            <Flag
              team={value}
              size="w80"
              style={{
                width: 20,
                height: 15,
                objectFit: 'cover',
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
          )}
          <input
            className="bg-transparent bg-none border-none text-white [outline:none] text-[1.1rem] w-full"
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : displayLabel}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            placeholder={placeholder}
            aria-label={placeholder || 'Buscar'}
          />
        </div>
        <span
          className={`text-[0.8em] text-white [transition:transform_0.2s] cursor-pointer ${isOpen ? '[transform:rotate(180deg)]' : '[transform:none]'}`}
          role="button"
          tabIndex={0}
          aria-label="Alternar menú desplegable"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          ▼
        </span>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[rgba(20,20,35,0.95)] bg-none border border-[rgba(255,255,255,0.1)] rounded-[12px] max-h-75 overflow-y-auto z-[100] shadow-[0_10px_30px_rgba(0,0,0,0.8)] [backdrop-filter:blur(10px)]">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const val = optionValue(opt);
              const label = optionLabel(opt);
              const icon = optionIcon(opt);
              return (
                <div
                  className={`py-3 px-5 flex items-center gap-2.5 cursor-pointer [transition:background_0.2s] text-white ${value === val ? 'bg-[rgba(0,_210,_211,_0.2)] bg-none' : 'bg-transparent bg-none'}`}
                  key={val}
                  role="option"
                  tabIndex={0}
                  aria-selected={value === val}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChange(val);
                      setIsOpen(false);
                      setSearchTerm('');
                    }
                  }}
                  onClick={() => {
                    onChange(val);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  onMouseOver={(e) => {
                    if (value !== val) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseOut={(e) => {
                    if (value !== val) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {icon && <span>{icon}</span>}
                  {withFlags && (
                    <Flag
                      team={val}
                      size="w80"
                      style={{
                        width: 20,
                        height: 15,
                        objectFit: 'cover',
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span>{label}</span>
                </div>
              );
            })
          ) : (
            <div className="py-3 px-5 text-muted italic">No hay resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Componente que muestra la página de Búsqueda y Análisis de pronósticos.
 * Permite buscar por equipo y condición o ver el perfil psicológico de un usuario.
 *
 * @component
 * @returns {JSX.Element} La vista de la central de inteligencia.
 */
function Search() {
  const {
    participantsHashes,
    groupOdds,
    loading,
    userName,
    setViewerPredictionId,
    activeGroupPichichi,
    leaderboardData,
  } = useAppContext();

  // Los pronósticos no traen la foto; la clasificación de la liga sí.
  const avatarByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of leaderboardData) {
      if (row.userId !== null && row.avatarUrl) map.set(row.userId, row.avatarUrl);
    }
    return map;
  }, [leaderboardData]);

  // Read initial state from URL parameters (if shared link), fallback to localStorage, then default
  const urlParams = new URLSearchParams(window.location.search);
  const [searchMode, setSearchMode] = useState(
    urlParams.get('mode') || localStorage.getItem('searchMode') || 'team',
  );
  const [selectedTeam, setSelectedTeam] = useState(
    urlParams.get('team') || localStorage.getItem('searchTeam') || '',
  );
  const [selectedCondition, setSelectedCondition] = useState(
    urlParams.get('condition') || localStorage.getItem('searchCondition') || 'passes_groups',
  );
  const [selectedUser, setSelectedUser] = useState(
    urlParams.get('user') || localStorage.getItem('searchUser') || '',
  );

  // Update localStorage when state changes (keeps URL clean)
  useEffect(() => {
    localStorage.setItem('searchMode', searchMode);
    if (searchMode === 'team') {
      if (selectedTeam) localStorage.setItem('searchTeam', selectedTeam);
      if (selectedCondition) localStorage.setItem('searchCondition', selectedCondition);
    } else {
      if (selectedUser) localStorage.setItem('searchUser', selectedUser);
    }

    // Optional: Clean up URL if they arrived from a shared link, to keep it clean.
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchMode, selectedTeam, selectedCondition, selectedUser]);

  const handleShareTeam = () => {
    const url = `https://porra.raclos.es/search?mode=team&team=${encodeURIComponent(selectedTeam)}&condition=${encodeURIComponent(selectedCondition)}`;
    const text = `¡Mira lo que la gente ha votado sobre ${selectedTeam} en PorrApp!\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareUser = () => {
    const url = `https://porra.raclos.es/search?mode=user&user=${encodeURIComponent(selectedUser)}`;
    const text = `¡Mira el perfil psicológico de ${selectedUser} en PorrApp!\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const { allTeams, allUsers, teamResults, teamNegativeResults, userStats } = useSearchStats(
    participantsHashes,
    groupOdds,
    userName,
    selectedTeam,
    selectedCondition,
    selectedUser,
  );

  if (loading) return <div className="text-center p-8">Cargando buscador...</div>;

  const totalVotes = participantsHashes.length;
  const teamPercentage = teamResults ? Math.round((teamResults.length / totalVotes) * 100) : 0;

  return (
    <section id="view-search" className="view-section block opacity-[1]">
      <div className="section-header mb-7.5">
        <h2 className="text-[#f368e0] text-[2.5rem] mt-0 mb-2.5 mx-0">Central de Inteligencia</h2>
        <p className="text-[1.1rem] text-muted">
          Investiga los pronósticos del grupo o analiza el perfil psicológico de tus rivales.
        </p>
      </div>

      <div className="flex justify-center mb-[35px]">
        <div className="flex bg-[rgba(15,_23,_42,_0.8)] bg-none p-[5px] rounded-[16px] border border-[rgba(255,_255,_255,_0.12)] shadow-[0_8px_25px_rgba(0,_0,_0,_0.5),_inset_0_1px_0_rgba(255,_255,_255,_0.1)] [backdrop-filter:blur(12px)] relative gap-1.5">
          <button
            className={`py-2.5 px-7.5 font-extrabold text-[1.05rem] border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-2 tracking-[0.5px] ${searchMode === 'team' ? 'bg-accent bg-none' : 'bg-transparent bg-none'} ${searchMode === 'team' ? 'text-white' : 'text-muted'} ${searchMode === 'team' ? 'shadow-[0_4px_12px_rgba(0,_0,_0,_0.25)]' : 'shadow-none'}`}
            onClick={() => setSearchMode('team')}
          >
            🔍 Por Equipo
          </button>
          <button
            className={`py-2.5 px-7.5 font-extrabold text-[1.05rem] border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-2 tracking-[0.5px] ${searchMode === 'user' ? 'bg-cyan bg-none' : 'bg-transparent bg-none'} ${searchMode === 'user' ? 'text-black' : 'text-muted'} ${searchMode === 'user' ? 'shadow-[0_4px_12px_rgba(0,_0,_0,_0.25)]' : 'shadow-none'}`}
            onClick={() => setSearchMode('user')}
          >
            🧠 Perfil de Jugador
          </button>
        </div>
      </div>

      {searchMode === 'team' && (
        <div className="bg-[rgba(20,20,35,0.8)] bg-none border border-[rgba(243,_104,_224,_0.3)] p-10 rounded-[16px]">
          <div className="flex flex-wrap gap-5 mb-10 justify-center">
            <div className="flex-[1_1_300px] flex flex-col items-center">
              <label className="block mb-[15px] text-muted font-bold text-[1.1rem]">
                Selecciona Equipo:
              </label>
              <CustomDropdown
                value={selectedTeam}
                onChange={setSelectedTeam}
                options={allTeams}
                placeholder="-- Elige un equipo --"
                withFlags={true}
              />
            </div>
            <div className="flex-[1_1_300px] flex flex-col items-center">
              <label className="block mb-[15px] text-muted font-bold text-[1.1rem]">
                Selecciona Condición:
              </label>
              <CustomDropdown
                value={selectedCondition}
                onChange={setSelectedCondition}
                options={searchConditions}
                placeholder="-- Elige condición --"
              />
            </div>
          </div>

          {selectedTeam && teamResults && (
            <div className="bg-[rgba(0,0,0,0.3)] bg-none rounded-[16px] p-7.5 border border-[rgba(255,255,255,0.05)]">
              <div className="flex items-center justify-center gap-[15px] mb-[25px]">
                <Flag
                  team={selectedTeam}
                  size="48x36"
                  style={{
                    width: 48,
                    height: 36,
                    borderRadius: 4,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                  }}
                />
                <h3 className="m-0 text-[2rem]">{selectedTeam}</h3>
              </div>

              <div className="text-center mb-[35px]">
                <div className="text-[1.3rem] text-muted">
                  <strong className="text-[#f368e0] text-[2rem]">{teamPercentage}%</strong> del
                  grupo piensa esto ({teamResults.length} de {totalVotes})
                </div>
                <div className="w-full max-w-125 mt-[15px] mb-0 mx-auto bg-[rgba(255,255,255,0.1)] bg-none h-4 rounded-[8px] overflow-hidden">
                  <div
                    className="bg-[#f368e0] bg-none h-full [transition:width_1.5s_cubic-bezier(0.4,_0,_0.2,_1)]"
                    style={{ width: `${teamPercentage}%` }}
                  ></div>
                </div>
              </div>

              {teamResults.length > 0 || (teamNegativeResults && teamNegativeResults.length > 0) ? (
                <div className="flex flex-wrap gap-3 justify-center">
                  {teamResults.map((r) => (
                    <div
                      className="cursor-pointer bg-[rgba(243,_104,_224,_0.1)] bg-none border border-[rgba(243,_104,_224,_0.3)] py-2.5 px-5 rounded-[10px] flex items-center gap-2.5 text-[1.1rem] [transition:transform_0.2s,_boxShadow_0.2s]"
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver porra de ${r.name || 'participante'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setViewerPredictionId(r.id);
                        }
                      }}
                      onClick={() => setViewerPredictionId(r.id)}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <UserAvatar
                        url={r.userId !== null ? avatarByUserId.get(r.userId) : null}
                        userId={r.userId}
                        name={r.name}
                        size={24}
                      />
                      {r.name}
                    </div>
                  ))}
                  {teamNegativeResults &&
                    teamNegativeResults.map((r) => (
                      <div
                        className="cursor-pointer bg-[rgba(255,_255,_255,_0.03)] bg-none border border-dashed border-[rgba(255,_255,_255,_0.2)] py-2.5 px-5 rounded-[10px] flex items-center gap-2.5 text-[1.05rem] text-muted opacity-[0.45] [transition:all_0.2s_cubic-bezier(0.4,_0,_0.2,_1)]"
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver porra de ${r.name || 'participante'}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setViewerPredictionId(r.id);
                          }
                        }}
                        onClick={() => setViewerPredictionId(r.id)}
                        onMouseOver={(e) => {
                          e.currentTarget.style.opacity = '0.95';
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.border = '1px solid rgba(255, 100, 100, 0.4)';
                          e.currentTarget.style.background = 'rgba(255, 100, 100, 0.1)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.opacity = '0.45';
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.border = '1px dashed rgba(255, 255, 255, 0.2)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <span className="bg-[rgba(255,_255,_255,_0.1)] bg-none text-[#ff6b6b] w-6 h-6 rounded-full flex items-center justify-center text-[0.8rem] font-bold">
                          ✕
                        </span>
                        <span className="line-through">{r.name}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center text-muted italic text-[1.1rem]">
                  Nadie ha pronosticado esta combinación.
                </div>
              )}

              <div className="flex justify-center mt-[35px]">
                <button
                  onClick={handleShareTeam}
                  className="glass-btn py-2.5 px-[25px] rounded-[10px] bg-[#25D366] bg-none text-white border border-[#25D366] flex items-center gap-2.5 text-[1.1rem]"
                >
                  <WhatsAppIcon size={20} /> Compartir Búsqueda
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {searchMode === 'user' && (
        <div className="bg-[rgba(20,20,35,0.8)] bg-none border border-[rgba(0,_210,_211,_0.3)] p-10 rounded-[16px]">
          <div className="mb-10 flex flex-col items-center">
            <label className="block mb-[15px] text-muted font-bold text-[1.1rem]">
              Selecciona Jugador para ver su Perfil:
            </label>
            <CustomDropdown
              value={selectedUser}
              onChange={setSelectedUser}
              options={allUsers}
              placeholder="-- Elige un jugador --"
            />
          </div>

          {selectedUser && userStats && (
            <div className="bg-[rgba(0,0,0,0.3)] bg-none rounded-[16px] p-7.5 border border-[rgba(255,255,255,0.05)]">
              <div className="flex flex-col items-center mb-7.5">
                <h3 className="mt-0 mb-2.5 mx-0 text-[#00d2d3] text-[2rem] text-center">
                  Perfil de {selectedUser}
                </h3>

                {userName && userName !== selectedUser && (
                  <div className="flex items-center gap-2.5 bg-[rgba(0,_210,_211,_0.1)] bg-none py-2.5 px-5 rounded-[20px] border border-[rgba(0,_210,_211,_0.3)]">
                    <span className="text-[1.5rem]">🎯</span>
                    <span className="text-[1.1rem]">
                      Similitud con tu porra: <strong>{userStats.similarity}%</strong>
                    </span>
                  </div>
                )}
                {userName === selectedUser && (
                  <div className="flex items-center gap-2.5 bg-[rgba(241,_196,_15,_0.1)] bg-none py-2.5 px-5 rounded-[20px] border border-[rgba(241,_196,_15,_0.3)] text-[#f1c40f]">
                    <span className="text-[1.5rem]">👑</span>
                    <span className="text-[1.1rem]">Este eres tú. ¡Mucha suerte!</span>
                  </div>
                )}
                <div className="flex gap-[15px] flex-wrap justify-center mt-[15px]">
                  {userStats.id && (
                    <button
                      onClick={() => setViewerPredictionId(userStats.id)}
                      className="glass-btn primary-btn py-2 px-[25px] rounded-[10px] text-[1.1rem] bg-[rgba(0,_210,_211,_0.2)] bg-none border border-[#00d2d3] text-[#00d2d3] flex items-center gap-2"
                    >
                      👁️ Ver Porra Completa
                    </button>
                  )}
                  <button
                    onClick={handleShareUser}
                    className="glass-btn py-2 px-[25px] rounded-[10px] text-[1.1rem] bg-[#25D366] bg-none text-white border border-[#25D366] flex items-center gap-2"
                  >
                    <WhatsAppIcon size={20} /> Compartir Perfil
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,_minmax(220px,_1fr))] gap-5 mb-7.5">
                <div className="bg-[rgba(255,255,255,0.03)] bg-none p-5 rounded-[12px] text-center border border-[rgba(255,255,255,0.05)]">
                  <div className="text-[2.5rem] mb-2.5">🏆</div>
                  <div className="text-muted text-[0.9rem] uppercase tracking-[1px]">Campeón</div>
                  <div className="font-bold text-[1.3rem] flex items-center justify-center gap-2.5 mt-2.5">
                    <Flag
                      team={userStats.champion}
                      size="24x18"
                      style={{ width: 24, height: 18, borderRadius: 2 }}
                    />
                    {userStats.champion || 'No elegido'}
                  </div>
                </div>

                {activeGroupPichichi && (
                  <div className="bg-[rgba(255,255,255,0.03)] bg-none p-5 rounded-[12px] text-center border border-[rgba(255,255,255,0.05)]">
                    <div className="text-[2.5rem] mb-2.5">👟</div>
                    <div className="text-muted text-[0.9rem] uppercase tracking-[1px]">
                      Pichichi
                    </div>
                    <div className="font-bold text-[1.3rem] mt-2.5">
                      {userStats.scorer || 'No elegido'}
                    </div>
                  </div>
                )}

                <div className="bg-[rgba(255,255,255,0.03)] bg-none p-5 rounded-[12px] text-center border border-[rgba(255,255,255,0.05)]">
                  <div className="text-[2.5rem] mb-2.5">⚔️</div>
                  <div className="text-muted text-[0.9rem] uppercase tracking-[1px]">Su Final</div>
                  <div className="font-bold text-[1.1rem] flex items-center justify-center gap-2.5 mt-2.5">
                    {userStats.final && userStats.final.length === 2 ? (
                      <>
                        <Flag
                          team={userStats.final[0]}
                          size="20x15"
                          style={{ width: 20, height: 15, borderRadius: 2 }}
                        />
                        <span className="text-muted text-[0.9rem]">vs</span>
                        <Flag
                          team={userStats.final[1]}
                          size="20x15"
                          style={{ width: 20, height: 15, borderRadius: 2 }}
                        />
                      </>
                    ) : (
                      'No completada'
                    )}
                  </div>
                </div>
              </div>

              {/* Psicología */}
              <div className="grid grid-cols-[repeat(auto-fit,_minmax(280px,_1fr))] gap-5">
                <div className="bg-[rgba(232,_67,_147,_0.1)] bg-none border border-[rgba(232,_67,_147,_0.3)] p-5 rounded-[12px]">
                  <h4 className="text-[#e84393] mt-0 flex items-center gap-2.5 text-[1.2rem]">
                    🦄 Sus "Locuras"
                  </h4>
                  <p className="text-[var(--text-muted)] text-sm mb-4">
                    Equipos no favoritos que ha metido en Cuartos o Semis.
                  </p>
                  {userStats.madness.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5">
                      {userStats.madness.map((t) => (
                        <div
                          className="flex items-center gap-1.5 bg-[rgba(0,0,0,0.4)] bg-none py-1.5 px-3 rounded-[15px] text-[0.95rem]"
                          key={t}
                        >
                          <Flag
                            team={t}
                            size="w80"
                            style={{
                              width: 16,
                              height: 12,
                              objectFit: 'cover',
                              borderRadius: 2,
                            }}
                          />
                          {t}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="italic text-white/40">Es muy conservador. Cero locuras.</div>
                  )}
                </div>

                <div className="bg-[rgba(155,_89,_182,_0.1)] bg-none border border-[rgba(155,_89,_182,_0.3)] p-5 rounded-[12px]">
                  <h4 className="text-[#9b59b6] mt-0 flex items-center gap-2.5 text-[1.2rem]">
                    💀 Sus "Haters"
                  </h4>
                  <p className="text-[var(--text-muted)] text-sm mb-4">
                    Equipos top que ha fulminado en Fase de Grupos.
                  </p>
                  {userStats.haters.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5">
                      {userStats.haters.map((t) => (
                        <div
                          className="flex items-center gap-1.5 bg-[rgba(0,0,0,0.4)] bg-none py-1.5 px-3 rounded-[15px] text-[0.95rem]"
                          key={t}
                        >
                          <Flag
                            team={t}
                            size="w80"
                            style={{
                              width: 16,
                              height: 12,
                              objectFit: 'cover',
                              borderRadius: 2,
                            }}
                          />
                          {t}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="italic text-white/40">
                      Respeta mucho a los favoritos. Todos pasan.
                    </div>
                  )}
                </div>

                <div className="bg-[rgba(231,_76,_60,_0.1)] bg-none border border-[rgba(231,_76,_60,_0.3)] p-5 rounded-[12px]">
                  <h4 className="text-[#e74c3c] mt-0 flex items-center gap-2.5 text-[1.2rem]">
                    🏥 ¡Al Psiquiatra!
                  </h4>
                  <p className="text-[var(--text-muted)] text-sm mb-4">
                    Pronósticos que ha hecho y que <strong>nadie más</strong> ha elegido en todo el
                    grupo.
                  </p>
                  {userStats.asylum && userStats.asylum.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {userStats.asylum.map((item) => (
                        <div
                          className="bg-[rgba(0,0,0,0.4)] bg-none p-2.5 rounded-[10px] text-[0.9rem]"
                          key={item.team}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-[#e74c3c] mb-1">
                            <Flag
                              team={item.team}
                              size="w80"
                              style={{
                                width: 16,
                                height: 12,
                                objectFit: 'cover',
                                borderRadius: 2,
                              }}
                            />
                            {item.team}
                          </div>
                          <div className="text-[rgba(255,255,255,0.8)]">
                            Único en predecir:{' '}
                            <span className="italic">{item.labels.join(', ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="italic text-white/40">
                      Persona muy normal. Todo lo que dice ya se le había ocurrido a alguien más.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default Search;
