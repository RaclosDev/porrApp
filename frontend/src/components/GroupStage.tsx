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

type Selections = Record<string, GroupSelection>;

const getSavedSelections = (groupId: string): Selections => {
  try {
    const saved = localStorage.getItem('draft_groups_' + groupId);
    if (!saved) return {};
    const parsed = normalizeSelections(JSON.parse(saved));
    return hasValidGroupSelections(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const getSavedThirds = (groupId: string): string[] => {
  try {
    const saved = localStorage.getItem('draft_advancing_' + groupId);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * Componente interactivo para que el usuario prediga la Fase de Grupos.
 * Permite elegir 1º, 2º y hasta 8 equipos como los "Mejores Terceros".
 * Persiste los datos en localStorage en caso de recarga o cierre.
 */
export default function GroupStage({
  groupOdds,
  onComplete,
  activeGroupId,
  initialSelections,
  initialThirds,
}: {
  groupOdds: GroupOdds;
  /** Se llama cuando el usuario valida su fase de grupos. */
  onComplete: (selections: Selections, thirds: string[]) => void;
  /** Liga activa; separa los borradores en localStorage. */
  activeGroupId: string;
  initialSelections?: unknown;
  initialThirds?: string[];
}) {
  const [selections, setSelections] = useState<Selections>(() => {
    if (hasValidGroupSelections(initialSelections)) {
      return normalizeSelections(initialSelections);
    }
    const saved = getSavedSelections(activeGroupId);
    if (hasValidGroupSelections(saved)) {
      return saved;
    }
    return normalizeSelections(initialSelections || {});
  });

  const [advancingThirds, setAdvancingThirds] = useState<string[]>(() => {
    if (initialThirds && Array.isArray(initialThirds) && initialThirds.length > 0) {
      return initialThirds;
    }
    return getSavedThirds(activeGroupId);
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
      const saved = getSavedSelections(activeGroupId);
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
  }, [initialSelections, activeGroupId]);

  useEffect(() => {
    if (initialThirds && Array.isArray(initialThirds) && initialThirds.length > 0) {
      setAdvancingThirds(initialThirds);
    } else {
      const saved = getSavedThirds(activeGroupId);
      if (saved && saved.length > 0) {
        setAdvancingThirds(saved);
      }
    }
  }, [initialThirds, activeGroupId]);

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
      localStorage.setItem('draft_groups_' + activeGroupId, JSON.stringify(selections));
    }
  }, [selections, activeGroupId]);

  useEffect(() => {
    if (advancingThirds && advancingThirds.length > 0 && activeGroupId) {
      localStorage.setItem('draft_advancing_' + activeGroupId, JSON.stringify(advancingThirds));
    }
  }, [advancingThirds, activeGroupId]);

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
    <div style={{ width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: 'var(--accent-color)', margin: '0 0 10px 0' }}>
          Paso 1: Fase de Grupos
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Selecciona 1º y 2º en cada grupo. Puedes marcar todos los 3º que quieras, y luego elegir a
          los 8 mejores abajo.
        </p>
      </div>

      {/* Pestañas para móvil */}
      <div className="mb-tabs hide-on-desktop">
        <button
          className={`mb-tab ${mobileStep === 'groups' ? 'mb-tab-active' : ''}`}
          onClick={() => setMobileStep('groups')}
        >
          Grupos
        </button>
        <button
          className={`mb-tab ${mobileStep === 'thirds' ? 'mb-tab-active' : ''}`}
          onClick={() => setMobileStep('thirds')}
        >
          Mejores Terceros
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
                className="group-card glass-panel"
                style={{
                  position: 'relative',
                  zIndex: 50 - idx,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 5px 0',
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    paddingBottom: '6px',
                    fontSize: '1.1rem',
                  }}
                >
                  Grupo {groupName}
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px',
                    marginBottom: '12px',
                  }}
                >
                  {teams.map((t) => (
                    <div
                      key={t.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '6px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
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
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: '500',
                        }}
                        title={t.name}
                      >
                        {t.name}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#00d2d3', fontWeight: 'bold' }}>
                    1º Clasificado:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CustomSelect
                      value={selections[groupName]?.first || ''}
                      onChange={(val) => handleSelect(groupName, 'first', val)}
                      placeholder="-- Seleccionar --"
                      options={[
                        { value: '', label: '-- Seleccionar --' },
                        ...teams.map((t) => ({ value: t.name, label: t.name })),
                      ]}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#a29bfe', fontWeight: 'bold' }}>
                    2º Clasificado:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CustomSelect
                      value={selections[groupName]?.second || ''}
                      onChange={(val) => handleSelect(groupName, 'second', val)}
                      placeholder="-- Seleccionar --"
                      options={[
                        { value: '', label: '-- Seleccionar --' },
                        ...teams.map((t) => ({ value: t.name, label: t.name })),
                      ]}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}
                  >
                    3º:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CustomSelect
                      value={selections[groupName]?.third || ''}
                      onChange={(val) => handleSelect(groupName, 'third', val)}
                      placeholder="-- Seleccionar --"
                      options={[
                        { value: '', label: '-- Seleccionar --' },
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
          Continuar a Mejores Terceros
        </button>
      </div>

      <div className={mobileStep === 'thirds' ? '' : 'mobile-step-hidden'}>
        <div
          style={{
            padding: '20px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            marginBottom: '30px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <h3 style={{ textAlign: 'center', color: '#a29bfe', marginTop: 0 }}>
            Selecciona los 8 Mejores Terceros
          </h3>
          <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Has marcado {selectedThirds.length} terceros en los grupos. Haz clic en los 8 que
            pasarán a octavos de final (
            <strong style={{ color: advancingThirds.length === 8 ? '#00b894' : '#ff4757' }}>
              {advancingThirds.length}/8
            </strong>
            ).
          </p>

          {selectedThirds.length === 0 ? (
            <p
              style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,0.3)',
                fontStyle: 'italic',
                marginTop: '20px',
              }}
            >
              Aún no has seleccionado ningún 3º clasificado en los grupos de arriba.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                justifyContent: 'center',
                marginTop: '15px',
              }}
            >
              {selectedThirds.map((t) => {
                const isSelected = advancingThirds.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleAdvancingThird(t)}
                    className="glass-btn"
                    style={{
                      background: isSelected ? 'rgba(0, 210, 211, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: isSelected ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                    }}
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

        <div
          style={{
            textAlign: 'center',
            padding: '20px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={handleSubmit}
            className="glass-btn primary-btn"
            style={{ fontSize: '1.2rem', padding: '12px 30px' }}
            disabled={advancingThirds.length !== 8}
          >
            Generar Eliminatorias
          </button>
          {advancingThirds.length !== 8 && (
            <p style={{ color: '#ff4757', fontSize: '0.9rem', marginTop: '10px' }}>
              Selecciona exactamente 8 terceros para continuar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
