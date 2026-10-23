import { useState } from 'react';
import GroupStage from '../components/GroupStage';
import BracketCanvas, { TeamSlot, matchTop, MATCH_H, COL_GAP } from '../components/BracketCanvas';
import { useBracket } from '../hooks/useBracket';

/**
 * Componente principal para crear una Porra (Pronóstico).
 * Coordina el paso 1 (Grupos) y el paso 2 (Eliminatorias).
 *
 * @component
 * @returns {JSX.Element} Vista interactiva para rellenar el bracket.
 */
function Bracket() {
  const {
    bracketState,
    userName,
    setUserName,
    topScorer,
    setTopScorer,
    betName,
    setBetName,
    myPreviousBets,
    isKnockoutsOnly,
    allTeams,
    isInitialState,
    isAuthenticated,
    activeGroupId,
    groupOdds,
    activeGroupPichichi,
    activeGroupIsLocked,
    handleCopyBet,
    setR32Team,
    advanceTeam,
    handleGroupStageComplete,
    generateBetData,
    getTeamStatus,
  } = useBracket();

  const [mobileStep, setMobileStep] = useState('bracket'); // 'bracket' | 'save'

  /** Slot renderer for BracketCanvas */
  const renderSlot = (team, { side, roundIndex, matchIndex, isHome }) => {
    // R32 in KNOCKOUTS_ONLY with placeholder → dropdown
    if (roundIndex === 0 && isKnockoutsOnly && team?.name?.includes('º')) {
      return (
        <select
          aria-label="Seleccionar equipo clasificado"
          className="glass-input"
          style={{ width: '100%', height: 42, padding: '0 10px', fontSize: '0.85rem' }}
          defaultValue=""
          onChange={(e) => e.target.value && setR32Team(e.target.value, side, matchIndex, isHome)}
        >
          <option value="" disabled>
            Seleccionar...
          </option>
          {allTeams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      );
    }
    // R32: read-only display with status indicator
    if (roundIndex === 0) {
      let statusIndicator = null;
      const name = team?.name;
      if (name && !name.includes('º')) {
        const teamStatus = getTeamStatus(name);
        if (teamStatus === 5) {
          statusIndicator = (
            <span
              title="Clasificado Matemáticamente"
              aria-label="Clasificado Matemáticamente"
              style={{
                width: '8px',
                height: '8px',
                background: '#3498db',
                borderRadius: '50%',
                marginLeft: '4px',
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
          );
        }
      }
      return <TeamSlot name={name} rightContent={statusIndicator} />;
    }
    // Other rounds: click to advance
    return (
      <TeamSlot name={team?.name} onClick={() => advanceTeam(team, side, roundIndex, matchIndex)} />
    );
  };

  const finalTopY = matchTop(3, 0);

  const renderCenter = (colW) => (
    <>
      {/* FINAL */}
      <div
        style={{
          position: 'absolute',
          top: finalTopY - 22,
          left: COL_GAP,
          width: colW,
          textAlign: 'center',
          fontSize: '0.65rem',
          fontWeight: 700,
          color: 'rgba(251,191,36,0.9)',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        ⚽ Final
      </div>
      <div
        className="match final-match"
        style={{ position: 'absolute', top: finalTopY, left: COL_GAP, width: colW }}
      >
        <TeamSlot
          name={bracketState.final?.home?.name}
          onClick={() =>
            bracketState.final?.home && advanceTeam(bracketState.final.home, 'center', 4, 0)
          }
        />
        <TeamSlot
          name={bracketState.final?.away?.name}
          onClick={() =>
            bracketState.final?.away && advanceTeam(bracketState.final.away, 'center', 4, 0)
          }
        />
      </div>

      {/* CAMPEÓN */}
      <div
        style={{
          position: 'absolute',
          top: finalTopY + MATCH_H + 18,
          left: COL_GAP,
          width: colW,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'var(--champion-gold)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          🏆 Campeón
        </div>
        <div className="champion-display">
          <TeamSlot name={bracketState.champion?.name} />
        </div>
      </div>

      {/* TERCER PUESTO */}
      <div
        style={{
          position: 'absolute',
          top: finalTopY + MATCH_H + 18 + MATCH_H + 44,
          left: COL_GAP,
          width: colW,
        }}
      >
        <div
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          🥉 Tercer Puesto
        </div>
        <div className="match third-place">
          <TeamSlot
            name={bracketState.thirdPlaceMatch?.home?.name}
            onClick={() =>
              bracketState.thirdPlaceMatch?.home &&
              advanceTeam(bracketState.thirdPlaceMatch.home, 'center', 5, 0)
            }
          />
          <TeamSlot
            name={bracketState.thirdPlaceMatch?.away?.name}
            onClick={() =>
              bracketState.thirdPlaceMatch?.away &&
              advanceTeam(bracketState.thirdPlaceMatch.away, 'center', 5, 0)
            }
          />
        </div>
        {bracketState.thirdPlaceWinner && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Ganador:
            </div>
            <TeamSlot name={bracketState.thirdPlaceWinner?.name} />
          </div>
        )}
      </div>
    </>
  );

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <section id="view-bracket" className="view-section" style={{ display: 'block' }}>
      {isInitialState ? (
        <>
          {myPreviousBets.length > 0 && (
            <div
              className="glass-panel"
              style={{
                padding: 20,
                marginBottom: 30,
                maxWidth: 800,
                margin: '0 auto 20px auto',
                border: '1px solid #00d2d3',
              }}
            >
              <h3
                style={{
                  margin: '0 0 10px 0',
                  color: '#00d2d3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span>💡</span> ¿Quieres usar la misma predicción?
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 15 }}>
                Hemos visto que ya rellenaste tu porra en otra liga. Puedes copiarla directamente
                sin rellenar todo el cuadro de nuevo.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {myPreviousBets.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => handleCopyBet(b.id)}
                    className="glass-btn primary-btn"
                    style={{ background: 'rgba(0,210,211,0.2)', border: '1px solid #00d2d3' }}
                  >
                    Copiar "{b.betName}"
                  </button>
                ))}
              </div>
            </div>
          )}
          <GroupStage
            groupOdds={groupOdds}
            onComplete={handleGroupStageComplete}
            activeGroupId={activeGroupId}
          />
        </>
      ) : (
        <>
          <div className="section-header" style={{ marginBottom: 40, textAlign: 'center' }}>
            <h2 style={{ margin: 0 }}>Paso 2: Eliminatorias</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.9rem' }}>
              Haz clic en un equipo para avanzarlo a la siguiente ronda
            </p>
          </div>

          {/* Pestañas para móvil */}
          <div className="mb-tabs hide-on-desktop">
            <button
              className={`mb-tab ${mobileStep === 'bracket' ? 'mb-tab-active' : ''}`}
              onClick={() => setMobileStep('bracket')}
            >
              Cuadro
            </button>
            <button
              className={`mb-tab ${mobileStep === 'save' ? 'mb-tab-active' : ''}`}
              onClick={() => setMobileStep('save')}
            >
              Guardar y Pichichi
            </button>
          </div>

          <div className={mobileStep === 'bracket' ? '' : 'mobile-step-hidden'}>
            <BracketCanvas
              leftRounds={[
                bracketState.r32.left,
                bracketState.r16.left,
                bracketState.qf.left,
                bracketState.sf.left,
              ]}
              rightRounds={[
                bracketState.r32.right,
                bracketState.r16.right,
                bracketState.qf.right,
                bracketState.sf.right,
              ]}
              renderSlot={renderSlot}
              renderCenter={renderCenter}
              mobileCenter={() => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Final */}
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'rgba(251,191,36,0.9)',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        marginBottom: 8,
                      }}
                    >
                      ⚽ Final
                    </div>
                    <div className="mb-match-card">
                      <TeamSlot
                        name={bracketState.final?.home?.name}
                        onClick={() =>
                          bracketState.final?.home &&
                          advanceTeam(bracketState.final.home, 'center', 4, 0)
                        }
                      />
                      <TeamSlot
                        name={bracketState.final?.away?.name}
                        onClick={() =>
                          bracketState.final?.away &&
                          advanceTeam(bracketState.final.away, 'center', 4, 0)
                        }
                      />
                    </div>
                  </div>
                  {/* Campeón */}
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--champion-gold)',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}
                    >
                      🏆 Campeón
                    </div>
                    <div className="champion-display">
                      <TeamSlot name={bracketState.champion?.name} />
                    </div>
                  </div>
                  {/* Tercer Puesto */}
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        marginBottom: 8,
                      }}
                    >
                      🥉 Tercer Puesto
                    </div>
                    <div className="mb-match-card">
                      <TeamSlot
                        name={bracketState.thirdPlaceMatch?.home?.name}
                        onClick={() =>
                          bracketState.thirdPlaceMatch?.home &&
                          advanceTeam(bracketState.thirdPlaceMatch.home, 'center', 5, 0)
                        }
                      />
                      <TeamSlot
                        name={bracketState.thirdPlaceMatch?.away?.name}
                        onClick={() =>
                          bracketState.thirdPlaceMatch?.away &&
                          advanceTeam(bracketState.thirdPlaceMatch.away, 'center', 5, 0)
                        }
                      />
                    </div>
                    {bracketState.thirdPlaceWinner && (
                      <div style={{ marginTop: 10, textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '0.65rem',
                            color: 'var(--text-muted)',
                            marginBottom: 4,
                          }}
                        >
                          Ganador:
                        </div>
                        <TeamSlot name={bracketState.thirdPlaceWinner?.name} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            />

            {/* Botón Siguiente en móvil para pasar a Guardar */}
            <div
              className={`hide-on-desktop ${mobileStep === 'bracket' ? '' : 'mobile-step-hidden'}`}
              style={{ textAlign: 'center', marginTop: '20px' }}
            >
              <button
                className="glass-btn primary-btn"
                onClick={() => {
                  window.scrollTo({ top: 0 });
                  setMobileStep('save');
                }}
              >
                Continuar a Guardar Porra
              </button>
            </div>
          </div>

          {/* Controls */}
          <div
            id="controls-section"
            className={mobileStep === 'save' ? '' : 'mobile-step-hidden'}
            style={{
              marginTop: 30,
              padding: 20,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h3 style={{ marginTop: 0, color: 'var(--accent-color)' }}>Guardar Porra</h3>
            <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', marginBottom: 15 }}>
              <input
                type="text"
                placeholder="Tu Nombre (Loguéate arriba primero)"
                aria-label="Tu Nombre"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="glass-input"
                style={{ flex: 1, minWidth: 200 }}
                disabled={isAuthenticated}
              />
              <input
                type="text"
                placeholder="Nombre de la Porra (ej: Mi Porra 1)"
                aria-label="Nombre de la Porra"
                value={betName}
                onChange={(e) => setBetName(e.target.value)}
                className="glass-input"
                style={{ flex: 1, minWidth: 200 }}
              />
              {activeGroupPichichi && (
                <input
                  type="text"
                  placeholder="Pichichi"
                  aria-label="Pichichi"
                  value={topScorer}
                  onChange={(e) => setTopScorer(e.target.value)}
                  className="glass-input"
                  style={{ flex: 1, minWidth: 200 }}
                />
              )}
            </div>
            {activeGroupIsLocked && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 8,
                  color: '#fca5a5',
                  marginBottom: 15,
                  fontSize: '0.9rem',
                }}
              >
                🔒 <b>Pronósticos cerrados:</b> El plazo para enviar o modificar porras en esta liga
                ha finalizado.
              </div>
            )}
            <button
              className="glass-btn primary-btn"
              onClick={generateBetData}
              disabled={activeGroupIsLocked}
              style={activeGroupIsLocked ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {activeGroupIsLocked ? 'Plazo Cerrado' : 'Guardar Pronóstico'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default Bracket;
