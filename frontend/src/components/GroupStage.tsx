import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import Flag from './Flag';
import CustomSelect from './CustomSelect';
import {
  hasValidGroupSelections,
  normalizeGroupsDraft as normalizeSelections,
  type GroupSelection,
} from '../utils/bracketDraft';
import type { GroupOdds } from '../types/api';
import {
  readGroupsDraft as getSavedSelections,
  readThirdsDraft as getSavedThirds,
  writeDraft,
} from '../utils/drafts';

type Selections = Record<string, GroupSelection>;

/**
 * Componente interactivo para que el usuario prediga la Fase de Grupos.
 * Permite elegir 1º, 2º y hasta 8 equipos como los "Mejores Terceros".
 * Persiste los datos en localStorage en caso de recarga o cierre.
 */
export default function GroupStage({
  groupOdds,
  onComplete,
  activeGroupId,
  userId,
  initialSelections,
  initialThirds,
}: {
  groupOdds: GroupOdds;
  /** Se llama cuando el usuario valida su fase de grupos. */
  onComplete: (selections: Selections, thirds: string[]) => void;
  /** Liga activa; separa los borradores en localStorage. */
  activeGroupId: string;
  /** Usuario actual; los borradores son de cada usuario. */
  userId: string;
  initialSelections?: unknown;
  initialThirds?: string[];
}) {
  const [selections, setSelections] = useState<Selections>(() => {
    if (hasValidGroupSelections(initialSelections)) {
      return normalizeSelections(initialSelections);
    }
    const saved = getSavedSelections(activeGroupId, userId);
    if (hasValidGroupSelections(saved)) {
      return saved;
    }
    return normalizeSelections(initialSelections || {});
  });

  const [advancingThirds, setAdvancingThirds] = useState<string[]>(() => {
    if (initialThirds && Array.isArray(initialThirds) && initialThirds.length > 0) {
      return initialThirds;
    }
    return getSavedThirds(activeGroupId, userId);
  });

  const [mobileStep, setMobileStep] = useState('groups'); // 'groups' | 'thirds'

  /**
   * Sincroniza las selecciones si llegan como props o si cambia la liga activa.
   */
  useEffect(() => {
    if (hasValidGroupSelections(initialSelections)) {
      setSelections((prev) => {
        const norm = normalizeSelections(initialSelections);
        const merged = { ...prev };
        Object.keys(norm).forEach((g) => {
          merged[g] = {
            first: norm[g]?.first || merged[g]?.first || '',
            second: norm[g]?.second || merged[g]?.second || '',
            third: norm[g]?.third || merged[g]?.third || '',
          };
        });
        return merged;
      });
    } else {
      const saved = getSavedSelections(activeGroupId, userId);
      if (hasValidGroupSelections(saved)) {
        setSelections((prev) => {
          const merged = { ...prev };
          Object.keys(saved).forEach((g) => {
            merged[g] = {
              first: saved[g]?.first || merged[g]?.first || '',
              second: saved[g]?.second || merged[g]?.second || '',
              third: saved[g]?.third || merged[g]?.third || '',
            };
          });
          return merged;
        });
      }
    }
  }, [initialSelections, activeGroupId, userId]);

  useEffect(() => {
    if (initialThirds && Array.isArray(initialThirds) && initialThirds.length > 0) {
      setAdvancingThirds(initialThirds);
    } else {
      const saved = getSavedThirds(activeGroupId, userId);
      if (saved && saved.length > 0) {
        setAdvancingThirds(saved);
      }
    }
  }, [initialThirds, activeGroupId, userId]);

  /**
   * Inicializa la estructura vacía de selecciones para grupos nuevos sin sobreescribir lo ya rellenado.
   */
  useEffect(() => {
    if (groupOdds && Object.keys(groupOdds).length > 0) {
      setSelections((prev) => {
        const next = { ...prev };
        let added = false;
        Object.keys(groupOdds).forEach((g) => {
          if (!next[g]) {
            next[g] = { first: '', second: '', third: '' };
            added = true;
          }
        });
        return added ? next : prev;
      });
    }
  }, [groupOdds]);

  /**
   * Guarda los avances del usuario en LocalStorage para no perder progreso cuando haya datos válidos.
   */
  useEffect(() => {
    if (hasValidGroupSelections(selections) && activeGroupId) {
      writeDraft('groups', activeGroupId, userId, selections);
    }
  }, [selections, activeGroupId, userId]);

  useEffect(() => {
    if (advancingThirds && advancingThirds.length > 0 && activeGroupId) {
      writeDraft('advancing', activeGroupId, userId, advancingThirds);
    }
  }, [advancingThirds, activeGroupId, userId]);

  /**
   * Si el usuario desmarca a un tercero en un grupo, elimina a ese equipo de
   * la lista de "Mejores Terceros" seleccionados (advancingTieds).
   */
  useEffect(() => {
    const currentThirds = Object.values(selections)
      .map((g) => g.third)
      .filter((t) => t !== '');
    setTimeout(
      () => setAdvancingThirds((prev) => prev.filter((t) => currentThirds.includes(t))),
      0,
    );
  }, [selections]);

  /**
   * Maneja la selección de un equipo en un grupo y asegura que
   * no se pueda poner al mismo equipo en 1º y en 2º a la vez.
   */
  const handleSelect = (group: string, pos: keyof GroupSelection, teamName: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      const currentGroup = { ...next[group] };

      if (teamName) {
        if (pos !== 'first' && currentGroup.first === teamName) currentGroup.first = '';
        if (pos !== 'second' && currentGroup.second === teamName) currentGroup.second = '';
        if (pos !== 'third' && currentGroup.third === teamName) currentGroup.third = '';
      }

      currentGroup[pos] = teamName;
      next[group] = currentGroup;
      return next;
    });
  };

  /**
   * Agrega o quita un equipo a la lista final de 8 mejores terceros.
   */
  const toggleAdvancingThird = (team: string) => {
    setAdvancingThirds((prev) => {
      if (prev.includes(team)) return prev.filter((x) => x !== team);
      if (prev.length < 8) return [...prev, team];
      return prev;
    });
  };

  const selectedThirds = Object.values(selections)
    .map((g) => g.third)
    .filter((t) => t !== '');

  /**
   * Valida que todos los grupos tengan 1º y 2º, y que haya exactamente 8 terceros.
   */
  const handleSubmit = () => {
    const missingFirstsOrSeconds: string[] = [];
    Object.keys(selections).forEach((g) => {
      if (!selections[g].first || !selections[g].second) {
        missingFirstsOrSeconds.push(g);
      }
    });

    if (missingFirstsOrSeconds.length > 0) {
      toast.error(`Falta seleccionar 1º o 2º en los grupos: ${missingFirstsOrSeconds.join(', ')}`);
      return;
    }

    if (advancingThirds.length !== 8) {
      toast.error(
        `Debes seleccionar exactamente 8 mejores terceros (llevas ${advancingThirds.length}).`,
      );
      return;
    }

    onComplete(selections, advancingThirds);
  };

  return (
    <div className="w-full">
      <div className="text-center mb-7.5">
        <h2 className="poster-title text-accent-text mt-0 mb-2.5 mx-0">Paso 1: fase de grupos</h2>
        <p className="text-muted">
          Selecciona 1º y 2º en cada grupo. Puedes marcar todos los 3º que quieras, y luego elegir a
          los 8 mejores abajo.
        </p>
      </div>

      {/* Pestañas para móvil */}
      <div className="mb-tabs hide-on-desktop" role="tablist" aria-label="Fase de grupos">
        <button
          type="button"
          role="tab"
          aria-selected={mobileStep === 'groups'}
          className={`mb-tab ${mobileStep === 'groups' ? 'mb-tab-active' : ''}`}
          onClick={() => setMobileStep('groups')}
        >
          Grupos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileStep === 'thirds'}
          className={`mb-tab ${mobileStep === 'thirds' ? 'mb-tab-active' : ''}`}
          onClick={() => setMobileStep('thirds')}
        >
          Mejores terceros
        </button>
      </div>

      <div
        className={`groups-grid ${mobileStep === 'groups' ? '' : 'mobile-step-hidden'}`}
        style={{ marginBottom: '30px' }}
      >
        {Object.keys(groupOdds)
          .sort()
          .map((groupName, idx) => {
            const teams = groupOdds[groupName] || [];
            return (
              <div
                key={groupName}
                className="group-card paper-panel album-sheet relative flex flex-col gap-2"
                style={{ zIndex: 50 - idx }}
              >
                <h3 className="mt-0 mb-[5px] mx-0 text-center border-b border-b-[rgba(255,255,255,0.1)] pb-1.5 text-[1.1rem]">
                  Grupo {groupName}
                </h3>

                <div className="grid grid-cols-[1fr_1fr] gap-1.5 mb-3">
                  {teams.map((t) => (
                    <div
                      className="flex items-center justify-center gap-1.5 text-[0.85rem] bg-[rgba(255,255,255,0.1)] bg-none p-1.5 rounded-[4px] overflow-hidden"
                      key={t.name}
                    >
                      <Flag
                        team={t.name}
                        size="w80"
                        style={{
                          width: 16,
                          height: 12,
                          objectFit: 'cover',
                          borderRadius: '2px',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        className="whitespace-nowrap overflow-hidden text-ellipsis font-medium"
                        title={t.name}
                      >
                        {t.name}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[0.8rem] text-accent-text font-bold">1.º clasificado</span>
                  <div className="flex items-center">
                    <CustomSelect
                      value={selections[groupName]?.first || ''}
                      onChange={(val) => handleSelect(groupName, 'first', val)}
                      label={`Grupo ${groupName}, 1º clasificado`}
                      placeholder="Elige equipo"
                      options={[
                        { value: '', label: 'Elige equipo' },
                        ...teams.map((t) => ({ value: t.name, label: t.name })),
                      ]}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[0.8rem] text-accent-text font-bold">2.º clasificado</span>
                  <div className="flex items-center">
                    <CustomSelect
                      value={selections[groupName]?.second || ''}
                      onChange={(val) => handleSelect(groupName, 'second', val)}
                      label={`Grupo ${groupName}, 2º clasificado`}
                      placeholder="Elige equipo"
                      options={[
                        { value: '', label: 'Elige equipo' },
                        ...teams.map((t) => ({ value: t.name, label: t.name })),
                      ]}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[0.8rem] text-muted font-bold">3.º</span>
                  <div className="flex items-center">
                    <CustomSelect
                      value={selections[groupName]?.third || ''}
                      onChange={(val) => handleSelect(groupName, 'third', val)}
                      label={`Grupo ${groupName}, 3º clasificado`}
                      placeholder="Elige equipo"
                      options={[
                        { value: '', label: 'Elige equipo' },
                        ...teams.map((t) => ({ value: t.name, label: t.name })),
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Botón Siguiente en móvil para pasar a terceros */}
      <div
        className={`hide-on-desktop ${mobileStep === 'groups' ? '' : 'mobile-step-hidden'}`}
        style={{ textAlign: 'center', marginBottom: '30px' }}
      >
        <button
          className="glass-btn primary-btn"
          onClick={() => {
            window.scrollTo({ top: 0 });
            setMobileStep('thirds');
          }}
        >
          Continuar a mejores terceros
        </button>
      </div>

      <div className={mobileStep === 'thirds' ? '' : 'mobile-step-hidden'}>
        <div className="paper-panel album-sheet p-5 mb-7.5">
          <h3 className="text-center marker-ink mt-0">Elige los 8 mejores terceros</h3>
          <p className="text-center text-[0.9rem] text-muted">
            Has marcado {selectedThirds.length} terceros en los grupos. Haz clic en los 8 que
            pasarán a las eliminatorias (
            <strong
              className={`${advancingThirds.length === 8 ? 'text-[#00b894]' : 'text-[#ff4757]'}`}
            >
              {advancingThirds.length}/8
            </strong>
            ).
          </p>

          {selectedThirds.length === 0 ? (
            <p className="text-center text-muted italic mt-5">
              Aún no has seleccionado ningún 3º clasificado en los grupos de arriba.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2.5 justify-center mt-[15px]">
              {selectedThirds.map((t) => {
                const isSelected = advancingThirds.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleAdvancingThird(t)}
                    className={`glass-btn flex items-center gap-2 py-2 px-3 ${isSelected ? 'bg-[rgba(0,_210,_211,_0.2)] bg-none' : 'bg-[rgba(255,255,255,0.05)] bg-none'} ${isSelected ? 'border border-[#00d2d3]' : 'border border-[rgba(255,255,255,0.2)]'}`}
                  >
                    <Flag
                      team={t}
                      size="w80"
                      style={{
                        width: 16,
                        height: 12,
                        objectFit: 'cover',
                        borderRadius: '2px',
                      }}
                    />
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="paper-panel album-sheet text-center p-5">
          <button
            onClick={handleSubmit}
            className="glass-btn primary-btn text-[1.2rem] py-3 px-7.5"
            disabled={advancingThirds.length !== 8}
          >
            Ir a eliminatorias
          </button>
          {advancingThirds.length !== 8 && (
            <p className="text-[#ff4757] text-[0.9rem] mt-2.5">
              Selecciona exactamente 8 terceros para continuar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
