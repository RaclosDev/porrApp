import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useQuery } from '@tanstack/react-query';
import { fetchRules } from '../services/api';

/**
 * Vista de las Reglas y Puntuaciones de la porra.
 * Se adapta dinámicamente según la modalidad de la competición activa (Liga regular por jornadas vs Torneo por eliminatorias).
 *
 * @component
 * @returns {JSX.Element} Vista con las reglas del juego.
 */
function Rules() {
  const {
    participantsHashes,
    activeGroupPichichi,
    activeGroupPoolFormat,
    activeCompetitionFormatType,
    activeCompetitionName,
  } = useAppContext();

  const isCurrentMatchday =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  // Permite al usuario alternar entre reglas de Liga y reglas de Torneo
  const [selectedTab, setSelectedTab] = useState<'LEAGUE' | 'TOURNAMENT'>(
    isCurrentMatchday ? 'LEAGUE' : 'TOURNAMENT',
  );

  const { data: rules } = useQuery({ queryKey: ['rules'], queryFn: fetchRules });

  const qualifierPts = rules?.groupQualifierPoints ?? 10;
  const exactPosPts = rules?.groupExactPositionPoints ?? 10;
  const r32Pts = rules?.roundOf32Points ?? 25;
  const r16Pts = rules?.roundOf16Points ?? 30;
  const qfPts = rules?.quarterFinalPoints ?? 40;
  const sfPts = rules?.semiFinalPoints ?? 60;
  const championPts = rules?.championPoints ?? 200;
  const runnerUpPts = rules?.runnerUpPoints ?? 150;
  const thirdPts = rules?.thirdPlacePoints ?? 100;
  const fourthPts = rules?.fourthPlacePoints ?? 75;
  const pichichiPts = rules?.topScorerPoints ?? 200;

  const potTotal = (participantsHashes?.length || 0) * 5;

  return (
    <section id="view-rules" className="view-section" style={{ display: 'block', opacity: 1 }}>
      <div
        className="rules-container glass-panel"
        style={{
          marginTop: '32px',
          textAlign: 'left',
          padding: '28px',
          maxWidth: '1200px',
          marginLeft: 'auto',
          marginRight: 'auto',
          borderRadius: '16px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2
            style={{
              color: 'var(--primary-color)',
              fontSize: '1.75rem',
              fontWeight: 800,
              margin: 0,
            }}
          >
            📜 Reglas del Juego y Puntuaciones
          </h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', marginTop: '8px', fontSize: '0.95rem' }}>
            Consulta el sistema de puntos, criterios de desempate y funcionamiento del bote de
            premios.
          </p>

          {/* Selector de modo de juego */}
          <div
            style={{
              display: 'inline-flex',
              padding: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              marginTop: '16px',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setSelectedTab('LEAGUE')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
                transition: 'all 0.2s ease',
                background:
                  selectedTab === 'LEAGUE' ? 'var(--accent-color, #38bdf8)' : 'transparent',
                color: selectedTab === 'LEAGUE' ? '#0f172a' : 'var(--text-color, #e2e8f0)',
              }}
            >
              ⚽ Ligas por Jornadas{' '}
              {isCurrentMatchday && activeCompetitionName ? `(${activeCompetitionName})` : ''}
            </button>
            <button
              onClick={() => setSelectedTab('TOURNAMENT')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
                transition: 'all 0.2s ease',
                background:
                  selectedTab === 'TOURNAMENT' ? 'var(--accent-color, #38bdf8)' : 'transparent',
                color: selectedTab === 'TOURNAMENT' ? '#0f172a' : 'var(--text-color, #e2e8f0)',
              }}
            >
              🏆 Torneos y Copas (Mundial / Bracket)
            </button>
          </div>
        </div>

        {/* Información de Pago y Cuotas */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '28px',
            padding: '20px',
            background: 'rgba(0, 117, 235, 0.06)',
            borderRadius: '12px',
            border: '1px solid rgba(0, 117, 235, 0.2)',
          }}
        >
          <p
            style={{
              color: 'var(--text-color, #f1f5f9)',
              marginBottom: '12px',
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}
          >
            Las inscripciones permanecerán como <strong>"Pendiente"</strong> hasta que se haya
            abonado la cuota acordada en la peña. Puedes abonarla al administrador de tu peña o
            directamente por Revolut.
          </p>
          <a
            href="https://revolut.me/raclos"
            target="_blank"
            rel="noreferrer"
            className="glass-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              fontSize: '0.95rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: '#ffffff',
              background: '#0075eb',
              borderRadius: '8px',
              boxShadow: '0 4px 14px rgba(0, 117, 235, 0.35)',
            }}
          >
            💳 Pagar Cuota con Revolut
          </a>
          <p
            style={{
              color: '#f87171',
              fontWeight: 600,
              marginTop: '12px',
              fontSize: '0.88rem',
              marginBottom: 0,
            }}
          >
            ⚠️ ¡IMPORTANTE! Indica tu nombre o el de tu porra en el concepto del pago.
          </p>
        </div>

        {/* CONTENIDO MODO LIGA REGULAR (JORNADAS 1X2) */}
        {selectedTab === 'LEAGUE' && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                marginBottom: '24px',
              }}
            >
              {/* Pronósticos de Jornada */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h3
                  style={{
                    color: 'var(--accent-color, #38bdf8)',
                    margin: '0 0 14px 0',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '8px',
                  }}
                >
                  🎯 Puntuación por Partido
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    lineHeight: 2,
                    fontSize: '0.92rem',
                  }}
                >
                  <li>
                    ✔️ <strong>Signo 1X2 acertado:</strong>{' '}
                    <span style={{ color: '#4ade80', fontWeight: 'bold' }}>+3 pts</span>
                    <br />
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Aciertas victoria local, empate o visitante.
                    </span>
                  </li>
                  <li style={{ marginTop: '8px' }}>
                    🎯 <strong>Marcador Exacto acertado:</strong>{' '}
                    <span style={{ color: '#4ade80', fontWeight: 'bold' }}>+5 pts</span>
                    <br />
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Clavas el resultado exacto de goles del partido.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Plazos y Cierre */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h3
                  style={{
                    color: 'var(--accent-color, #38bdf8)',
                    margin: '0 0 14px 0',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '8px',
                  }}
                >
                  ⏱️ Cierre de Pronósticos
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    lineHeight: 1.8,
                    fontSize: '0.92rem',
                  }}
                >
                  <li>
                    🔒 <strong>Bloqueo por partido:</strong> Cada encuentro se bloquea
                    individualmente justo al inicio de su hora oficial.
                  </li>
                  <li style={{ marginTop: '6px' }}>
                    🔄 <strong>Edición libre:</strong> Puedes cambiar tu predicción tantas veces
                    como quieras antes de que arranque el choque.
                  </li>
                  <li style={{ marginTop: '6px' }}>
                    ⚡ <strong>Partidos restantes:</strong> Si se te pasa el partido del viernes,
                    sigues pudiendo pronosticar los del sábado y domingo.
                  </li>
                </ul>
              </div>

              {/* Bote de la Peña */}
              <div
                style={{
                  background: 'rgba(255, 215, 0, 0.04)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 215, 0, 0.25)',
                }}
              >
                <h3
                  style={{
                    color: '#ffd700',
                    margin: '0 0 14px 0',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(255, 215, 0, 0.25)',
                    paddingBottom: '8px',
                  }}
                >
                  💰 Bote Acumulado: {potTotal}€
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    lineHeight: 1.8,
                    fontSize: '0.92rem',
                  }}
                >
                  <li>
                    🥇 <strong>1º Clasificado de la Peña:</strong>
                    <br />
                    ¡Se lleva todo el bote acumulado menos 5€!
                  </li>
                  <li style={{ marginTop: '10px' }}>
                    🐢 <strong>Farolillo Rojo (Último):</strong>
                    <br />
                    Reembolso de 5€ de consolación.
                  </li>
                </ul>
              </div>
            </div>

            {/* Criterios de Desempate en Ligas */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <h3
                style={{
                  color: 'var(--accent-color, #38bdf8)',
                  margin: '0 0 12px 0',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '8px',
                }}
              >
                ⚖️ Criterios de Desempate en la Clasificación de la Peña
              </h3>
              <ol
                style={{
                  paddingLeft: '20px',
                  margin: 0,
                  lineHeight: 1.9,
                  color: 'var(--text-color, #e2e8f0)',
                  fontSize: '0.92rem',
                }}
              >
                <li>
                  <strong>Mayor número de Plenos (Marcadores Exactos acertados).</strong>
                </li>
                <li>
                  <strong>Mayor número de Signos 1X2 acertados.</strong>
                </li>
                <li>
                  <strong>Mayor puntuación obtenida en la última jornada disputada.</strong>
                </li>
                <li>
                  <strong>Fecha de registro / pronóstico más antiguo en la peña.</strong>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* CONTENIDO MODO TORNEO / BRACKET */}
        {selectedTab === 'TOURNAMENT' && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '20px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h3
                  style={{
                    color: 'var(--accent-color, #38bdf8)',
                    margin: '0 0 12px 0',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '8px',
                  }}
                >
                  Fase de Grupos
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    lineHeight: 1.8,
                    fontSize: '0.92rem',
                  }}
                >
                  <li>
                    ✔️ Acertar un clasificado: <b>{qualifierPts} pts</b>
                  </li>
                  <li>
                    🎯 Acertar posición exacta: <b>+{exactPosPts} pts</b>
                  </li>
                </ul>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h3
                  style={{
                    color: 'var(--accent-color, #38bdf8)',
                    margin: '0 0 12px 0',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '8px',
                  }}
                >
                  Eliminatorias
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    lineHeight: 1.8,
                    fontSize: '0.92rem',
                  }}
                >
                  <li>
                    ⚽ Pasan a Dieciseisavos: <b>{r32Pts} pts</b>
                  </li>
                  <li>
                    ⚽ Pasan a Octavos: <b>{r16Pts} pts</b>
                  </li>
                  <li>
                    ⚽ Pasan a Cuartos: <b>{qfPts} pts</b>
                  </li>
                  <li>
                    ⚽ Pasan a Semis / Final: <b>{sfPts} pts</b>
                  </li>
                </ul>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h3
                  style={{
                    color: 'var(--accent-color, #38bdf8)',
                    margin: '0 0 12px 0',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '8px',
                  }}
                >
                  Podio y Extras
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    lineHeight: 1.8,
                    fontSize: '0.92rem',
                  }}
                >
                  <li>
                    🏆 Campeón: <b>{championPts} pts</b> / 🥈 Sub: <b>{runnerUpPts} pts</b>
                  </li>
                  <li>
                    🥉 Tercero: <b>{thirdPts} pts</b> / 🏅 Cuarto: <b>{fourthPts} pts</b>
                  </li>
                  {activeGroupPichichi && pichichiPts > 0 && (
                    <li>
                      👟 Pichichi del Torneo: <b>{pichichiPts} pts</b>
                    </li>
                  )}
                </ul>
              </div>

              <div
                style={{
                  background: 'rgba(255, 215, 0, 0.04)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 215, 0, 0.25)',
                }}
              >
                <h3
                  style={{
                    color: '#ffd700',
                    margin: '0 0 12px 0',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(255, 215, 0, 0.25)',
                    paddingBottom: '8px',
                  }}
                >
                  💰 Bote: <span id="prize-pot-rules">{potTotal}€</span>
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    lineHeight: 1.8,
                    fontSize: '0.92rem',
                  }}
                >
                  <li>
                    🥇 <b>1º Clasificado:</b>
                    <br />
                    ¡Todo el bote menos 5€!
                  </li>
                  <li style={{ marginTop: '8px' }}>
                    🐢 <b>Último Clasificado:</b>
                    <br />
                    Reembolso de 5€.
                  </li>
                </ul>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <h3
                style={{
                  color: 'var(--accent-color, #38bdf8)',
                  margin: '0 0 12px 0',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '8px',
                }}
              >
                ⚖️ Criterios de Desempate Oficiales (Fase de Grupos)
              </h3>
              <ol
                style={{
                  paddingLeft: '20px',
                  margin: 0,
                  lineHeight: 1.8,
                  color: 'var(--text-color, #e2e8f0)',
                  fontSize: '0.92rem',
                }}
              >
                <li>
                  <b>Enfrentamientos directos (Puntos)</b> entre los empatados.
                </li>
                <li>
                  <b>Enfrentamientos directos (Diferencia de goles)</b> entre los empatados.
                </li>
                <li>
                  <b>Enfrentamientos directos (Goles a favor)</b> entre los empatados.
                </li>
                <li>
                  <b>Diferencia de goles general</b> en todos los partidos del grupo.
                </li>
                <li>
                  <b>Goles a favor general</b> anotados en todos los partidos del grupo.
                </li>
                <li>
                  <b>Conducta deportiva / Sorteo</b> (tarjetas o ranking FIFA).
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Rules;
