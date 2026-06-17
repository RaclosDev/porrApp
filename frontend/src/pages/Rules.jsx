import { useAppContext } from '../context/AppContext';

function Rules() {
  const { participantsHashes } = useAppContext();
  
  return (
    <section id="view-rules" className="view-section" style={{ display: 'block', opacity: 1 }}>
        <div className="rules-container glass-panel"
            style={{ marginTop: '40px', textAlign: 'left', padding: '25px', maxWidth: '1300px', marginLeft: 'auto', marginRight: 'auto' }}>
            <h2 style={{ textAlign: 'center', color: 'var(--primary-color)' }}>📜 Reglas y Puntuaciones</h2>
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                <p style={{ color: 'var(--text-color)', marginBottom: '10px' }}>Las apuestas permanecerán como "Pendiente"
                    hasta que se haya abonado la inscripción. Debes pagar al responsable que te haya pasado la
                    porra, que pagará al administrador. Una vez confirmado el pago, tu apuesta será aceptada y
                    válida.</p>
                <a href="https://revolut.me/raclos" target="_blank" rel="noreferrer" className="glass-btn"
                    style={{ display: 'inline-block', padding: '8px 20px', fontSize: '0.95rem', textDecoration: 'none', color: 'white', background: 'rgba(0, 117, 235, 0.2)', border: '1px solid #0075eb' }}>💳
                    Pagar Directamente con Revolut</a>
                <p style={{ color: '#ff4757', fontWeight: 'bold', marginTop: '10px', fontSize: '0.9rem' }}>⚠️ ¡IMPORTANTE!
                    Pon tu Nombre o Nombre de la Apuesta en el Concepto</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div
                    style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3
                        style={{ color: 'var(--accent-color)', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                        Fase de Grupos</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
                        <li>✔️ Acertar un clasificado: <b>10 pts</b></li>
                        <li>🎯 Acertar posición exacta: <b>+10 pts</b></li>
                    </ul>
                </div>
                <div
                    style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3
                        style={{ color: 'var(--accent-color)', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                        Eliminatorias</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
                        <li>⚽ Pasan a Octavos: <b>25 pts</b></li>
                        <li>⚽ Pasan a Cuartos: <b>30 pts</b></li>
                        <li>⚽ Pasan a Semis: <b>40 pts</b></li>
                        <li>⚽ Pasan a la Final: <b>60 pts</b></li>
                    </ul>
                </div>
                <div
                    style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3
                        style={{ color: 'var(--accent-color)', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                        Podio y Extras</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
                        <li>🏆 Campeón: <b>200 pts</b> / 🥈 Sub: <b>150 pts</b></li>
                        <li>🥉 Tercero: <b>100 pts</b> / 🏅 Cuarto: <b>75 pts</b></li>
                        <li>👟 Máximo Goleador: <b>100 pts</b></li>
                    </ul>
                </div>
                <div
                    style={{ background: 'rgba(255, 215, 0, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,215,0,0.3)' }}>
                    <h3
                        style={{ color: '#ffd700', marginBottom: '10px', borderBottom: '1px solid rgba(255,215,0,0.3)', paddingBottom: '5px' }}>
                        💰 Bote: <span id="prize-pot-rules">{participantsHashes.length * 5}€</span></h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
                        <li>🥇 <b>1º Clasificado:</b><br />¡Todo el bote menos 5€!</li>
                        <li style={{ marginTop: '8px' }}>🐢 <b>Último Clasificado:</b><br />Reembolso de 5€.</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>
  );
}

export default Rules;
