import { useAppContext } from '../context/AppContext';
import { useQuery } from '@tanstack/react-query';
import { fetchRules } from '../services/api';

/**
 * Vista de las Reglas y Puntuaciones de la porra.
 * Muestra las puntuaciones configuradas en el ScoringRuleSet activo.
 *
 * @component
 * @returns {JSX.Element} Vista con las reglas del juego.
 */
function Rules() {
  const { participantsHashes, activeGroupPichichi } = useAppContext();
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
  const pichichiPts = rules?.topScorerPoints ?? 100;

  return (
    <section id="view-rules" className="view-section" style={{ display: 'block', opacity: 1 }}>
      <div
        className="rules-container glass-panel"
        style={{
          marginTop: '40px',
          textAlign: 'left',
          padding: '25px',
          maxWidth: '1300px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <h2 style={{ textAlign: 'center', color: 'var(--primary-color)' }}>
          📜 Reglas y Puntuaciones
        </h2>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <p style={{ color: 'var(--text-color)', marginBottom: '10px' }}>
            Las porras permanecerán como "Pendiente" hasta que se haya abonado la inscripción. Debes
            pagar al responsable que te haya pasado la porra, que pagará al administrador. Una vez
            confirmado el pago, tu porra será confirmada y válida.
          </p>
          <a
            href="https://revolut.me/raclos"
            target="_blank"
            rel="noreferrer"
            className="glass-btn"
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              fontSize: '0.95rem',
              textDecoration: 'none',
              color: 'white',
              background: 'rgba(0, 117, 235, 0.2)',
              border: '1px solid #0075eb',
            }}
          >
            💳 Pagar Directamente con Revolut
          </a>
          <p
            style={{ color: '#ff4757', fontWeight: 'bold', marginTop: '10px', fontSize: '0.9rem' }}
          >
            ⚠️ ¡IMPORTANTE! Pon tu Nombre o Nombre de la Porra en el Concepto
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '15px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h3
              style={{
                color: 'var(--accent-color)',
                marginBottom: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '5px',
              }}
            >
              Fase de Grupos
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
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
              padding: '15px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h3
              style={{
                color: 'var(--accent-color)',
                marginBottom: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '5px',
              }}
            >
              Eliminatorias
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
              <li>
                ⚽ Pasan a Octavos: <b>{r32Pts} pts</b>
              </li>
              <li>
                ⚽ Pasan a Cuartos: <b>{r16Pts} pts</b>
              </li>
              <li>
                ⚽ Pasan a Semis: <b>{qfPts} pts</b>
              </li>
              <li>
                ⚽ Pasan a la Final: <b>{sfPts} pts</b>
              </li>
            </ul>
          </div>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '15px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h3
              style={{
                color: 'var(--accent-color)',
                marginBottom: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '5px',
              }}
            >
              Podio y Extras
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
              <li>
                🏆 Campeón: <b>{championPts} pts</b> / 🥈 Sub: <b>{runnerUpPts} pts</b>
              </li>
              <li>
                🥉 Tercero: <b>{thirdPts} pts</b> / 🏅 Cuarto: <b>{fourthPts} pts</b>
              </li>
              {activeGroupPichichi && pichichiPts > 0 && (
                <li>
                  👟 Pichichi: <b>{pichichiPts} pts</b>
                </li>
              )}
            </ul>
          </div>
          <div
            style={{
              background: 'rgba(255, 215, 0, 0.05)',
              padding: '15px',
              borderRadius: '12px',
              border: '1px solid rgba(255,215,0,0.3)',
            }}
          >
            <h3
              style={{
                color: '#ffd700',
                marginBottom: '10px',
                borderBottom: '1px solid rgba(255,215,0,0.3)',
                paddingBottom: '5px',
              }}
            >
              💰 Bote: <span id="prize-pot-rules">{participantsHashes.length * 5}€</span>
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
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
            padding: '15px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginTop: '20px',
          }}
        >
          <h3
            style={{
              color: 'var(--accent-color)',
              marginBottom: '10px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '5px',
            }}
          >
            ⚖️ Criterios de Desempate (Fase de Grupos)
          </h3>
          <ol
            style={{ paddingLeft: '20px', margin: 0, lineHeight: 1.8, color: 'var(--text-color)' }}
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
              <b>Conducta deportiva / Sorteo</b> (Aplicado manualmente por el administrador en caso
              de empate total, según tarjetas o ranking FIFA).
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

export default Rules;
