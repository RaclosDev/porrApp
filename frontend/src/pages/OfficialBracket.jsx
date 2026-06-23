import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchOfficialBracket } from '../services/api';
import BracketCanvas, { TeamSlot, matchTop, MATCH_H, COL_GAP } from '../components/BracketCanvas';

function OfficialBracket({ hideTitle }) {
  const { officialPoints } = useAppContext();
  const [part, setPart]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [vis, setVis]         = useState({ r32: true, r16: true, qf: true, sf: true, center: true });

  const injectQualifiedTeams = (partData, ptsData) => {
    if (!partData?.r32 || !ptsData) return partData;
    const guaranteed = {};
    Object.keys(ptsData).forEach(group => {
      guaranteed[group] = {};
      Object.keys(ptsData[group]).forEach(team => {
        const st = ptsData[group][team].status;
        if (st === 1) guaranteed[group]['1'] = team;
        else if (st === 2) guaranteed[group]['2'] = team;
      });
    });
    const newPart = JSON.parse(JSON.stringify(partData));
    newPart.r32 = newPart.r32.map(match =>
      match.map(teamName => {
        if (typeof teamName === 'string' && teamName.includes('º Grupo ')) {
          const parts = teamName.split(' ');
          const pos = parts[0].replace('º', '');
          const grp = parts[2];
          if (guaranteed[grp]?.[pos]) return guaranteed[grp][pos];
        }
        return teamName;
      })
    );
    return newPart;
  };

  useEffect(() => {
    fetchOfficialBracket()
      .then(data => { setPart(injectQualifiedTeams(data, officialPoints)); setLoading(false); })
      .catch(err => {
        console.error(err);
        if (err.message.includes('404') || err.message.includes('Aún no se ha generado')) {
          const fallback = {
            r32: [
              ['1º Grupo E','3º A/B/C/D/F'],['1º Grupo I','3º C/D/F/G/H'],
              ['2º Grupo A','2º Grupo B'],['1º Grupo F','2º Grupo C'],
              ['2º Grupo K','2º Grupo L'],['1º Grupo H','2º Grupo J'],
              ['1º Grupo D','3º B/E/F/I/J'],['1º Grupo G','3º A/E/H/I/J'],
              ['1º Grupo C','2º Grupo F'],['2º Grupo E','2º Grupo I'],
              ['1º Grupo A','3º C/E/F/H/I'],['1º Grupo L','3º E/H/I/J/K'],
              ['1º Grupo J','2º Grupo H'],['2º Grupo D','2º Grupo G'],
              ['1º Grupo B','3º E/F/G/I/J'],['1º Grupo K','3º D/E/I/J/L'],
            ],
            r16: Array(8).fill([null, null]),
            qf: Array(4).fill([null, null]),
            sf: Array(2).fill([null, null]),
            final: [null, null],
            thirdPlaceMatch: [null, null],
          };
          setPart(injectQualifiedTeams(fallback, officialPoints));
        } else {
          setError(err.message || 'Error al cargar el cuadro oficial');
        }
        setLoading(false);
      });
  }, [officialPoints]);

  if (loading) {
    return (
      <section className="view-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <h2 style={{ color: 'var(--text-muted)' }}>Cargando cuadro oficial...</h2>
      </section>
    );
  }

  if (error) {
    return (
      <section className="view-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '50vh', marginTop: 50 }}>
        <h2 style={{ color: '#ff4757', marginBottom: 15 }}>Cuadro Oficial</h2>
        <div className="glass-panel" style={{ padding: 30, textAlign: 'center', maxWidth: 500 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>{error}</p>
        </div>
      </section>
    );
  }

  if (!part) return null;

  // ── Convert flat arrays [name1, name2] → { home, away } ─────────────────
  const toMatches = (arr) => (arr || []).map(m => ({ home: m?.[0] || null, away: m?.[1] || null }));

  const leftRounds = [
    toMatches(part.r32?.slice(0, 8)),
    toMatches(part.r16?.slice(0, 4)),
    toMatches(part.qf?.slice(0, 2)),
    toMatches(part.sf?.slice(0, 1)),
  ];
  const rightRounds = [
    toMatches(part.r32?.slice(8, 16)),
    toMatches(part.r16?.slice(4, 8)),
    toMatches(part.qf?.slice(2, 4)),
    toMatches(part.sf?.slice(1, 2)),
  ];

  // ── Render slot (read-only, just a TeamSlot) ────────────────────────────
  const renderSlot = (name) => <TeamSlot name={name} />;

  // ── Hidden rounds from visibility toggles ──────────────────────────────
  const hiddenRounds = {
    0: !vis.r32,
    1: !vis.r16,
    2: !vis.qf,
    3: !vis.sf,
  };

  // ── Center content ───────────────────────────────────────────────────────
  const finalTopY = matchTop(3, 0);

  const centerContent = (colW) => (
    <div style={{ display: vis.center ? 'block' : 'none' }}>
      {/* FINAL */}
      <div style={{ position: 'absolute', top: finalTopY - 22, left: COL_GAP, width: colW, textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(251,191,36,0.9)', letterSpacing: 2, textTransform: 'uppercase' }}>
        🏆 Final 🏆
      </div>
      <div className="match final-match" style={{ position: 'absolute', top: finalTopY, left: COL_GAP, width: colW }}>
        <TeamSlot name={part.final?.[0]} />
        <TeamSlot name={part.final?.[1]} />
      </div>

      {/* CAMPEÓN */}
      <div style={{ position: 'absolute', top: finalTopY + MATCH_H + 18, left: COL_GAP, width: colW, textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--champion-gold)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>🏆 Campeón</div>
        <div className="champion-display">
          <div className="team-slot" style={{ height: 50, fontSize: '1.1rem', fontWeight: 'bold', justifyContent: 'center', pointerEvents: 'none', borderColor: '#fbbf24', background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
            {part.champion || '???'}
          </div>
        </div>
      </div>

      {/* TERCER PUESTO */}
      <div style={{ position: 'absolute', top: finalTopY + MATCH_H + 18 + MATCH_H + 44, left: COL_GAP, width: colW }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>🥉 Tercer Puesto</div>
        <div className="match third-place">
          <TeamSlot name={part.thirdPlaceMatch?.[0]} />
          <TeamSlot name={part.thirdPlaceMatch?.[1]} />
        </div>
      </div>
    </div>
  );

  // ── Toggle buttons ──────────────────────────────────────────────────────

  const ToggleBtn = ({ label, field }) => (
    <button
      className="glass-btn"
      style={{
        padding: '4px 10px', fontSize: '0.8rem', transition: 'all 0.2s ease',
        opacity: vis[field] ? 1 : 0.5,
        filter: vis[field] ? 'none' : 'grayscale(100%)',
        transform: vis[field] ? 'none' : 'scale(0.95)',
      }}
      onClick={() => setVis(p => ({ ...p, [field]: !p[field] }))}
    >
      👁️ {label}
    </button>
  );

  return (
    <section className="view-section" style={{ display: 'block', paddingTop: hideTitle ? 0 : 20 }}>
      {!hideTitle && (
        <div className="section-header" style={{ marginBottom: 20, textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--accent-color)' }}>Cuadro Oficial del Torneo</h2>
        </div>
      )}

      {/* Visibility toggles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 8, maxWidth: 800, margin: '0 auto 10px auto' }}>
        <strong style={{ color: 'var(--text-muted)', fontSize: '0.9em', display: 'flex', alignItems: 'center' }}>Mostrar:</strong>
        <ToggleBtn label="1/16"     field="r32" />
        <ToggleBtn label="Octavos"  field="r16" />
        <ToggleBtn label="Cuartos"  field="qf" />
        <ToggleBtn label="Semis"    field="sf" />
        <ToggleBtn label="Finales"  field="center" />
      </div>

      <BracketCanvas
        leftRounds={leftRounds}
        rightRounds={rightRounds}
        renderSlot={renderSlot}
        renderCenter={centerContent}
        hiddenRounds={hiddenRounds}
      />
    </section>
  );
}

export default OfficialBracket;
