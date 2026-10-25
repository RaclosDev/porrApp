import React from 'react';

export default function Landing() {
  return (
    <div
      className="landing-page"
      style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px 60px' }}
    >
      {/* Hero Section */}
      <section
        style={{
          textAlign: 'center',
          padding: '50px 20px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.5px',
            color: '#fff',
            maxWidth: '850px',
            margin: '0 auto',
          }}
        >
          La porra de toda la vida,{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #00d2d3 0%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            pero bien hecha.
          </span>
        </h1>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px 12px',
            maxWidth: '650px',
            margin: '8px auto 0',
            padding: '0 10px',
          }}
        >
          {[
            { icon: '🏆', text: '+10 Competiciones' },
            { icon: '⚡', text: 'Puntos en tiempo real' },
            { icon: '👥', text: 'Ligas con amigos' },
            { icon: '❌', text: 'Cero líos de Excel' },
          ].map((item) => (
            <div
              key={item.text}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '9999px',
                fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                color: '#e2e8f0',
                fontWeight: 500,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
              }}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '15px',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginTop: '15px',
          }}
        >
          <button
            id="btn-hero-login"
            onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
            className="glass-btn primary-btn"
            style={{
              padding: '14px 28px',
              fontSize: '1.05rem',
              fontWeight: 800,
              minHeight: '50px',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 8px 25px rgba(0, 210, 211, 0.3)',
            }}
          >
            <span>⚽</span>
            <span>Empezar a Jugar</span>
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ margin: '45px 0 25px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(1.5rem, 3.2vw, 2.1rem)',
              color: '#fff',
              marginBottom: '8px',
            }}
          >
            Todo lo que necesitas para tu porra
          </h2>
          <p
            style={{
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '0.95rem',
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            Sin líos de Excel ni hojas de cálculo. Todo automatizado para competir con tus amigos.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Feature 1 */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(251, 191, 36, 0.15)',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              🏆
            </div>
            <h3
              style={{
                fontSize: '1.08rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Cuadros Eliminatorios
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Árbol visual interactivo hasta la Gran Final con cruces automáticos, desempates y
              Pichichi.
            </p>
          </div>

          {/* Feature 2 */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(0, 210, 211, 0.15)',
                color: '#00d2d3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              ⚽
            </div>
            <h3
              style={{
                fontSize: '1.08rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Ligas por Jornadas
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Para LaLiga, Premier y Champions. Pronósticos fecha a fecha con marcadores al minuto.
            </p>
          </div>

          {/* Feature 3 */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              👥
            </div>
            <h3
              style={{
                fontSize: '1.08rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Ligas Privadas
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Crea tu liga en 10 segundos e invita a tus amigos por WhatsApp con un simple enlace.
            </p>
          </div>

          {/* Feature 4 */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              📊
            </div>
            <h3
              style={{
                fontSize: '1.08rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Directo y Clasificación
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Tabla de posiciones en tiempo real, desglose detallado de puntos y evolución del
              ranking.
            </p>
          </div>

          {/* Feature 5 */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              📱
            </div>
            <h3
              style={{
                fontSize: '1.08rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              App Instalable (PWA)
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Instálala en tu móvil iOS o Android con un toque para consultar los partidos en
              cualquier lugar.
            </p>
          </div>

          {/* Feature 6 */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              🔒
            </div>
            <h3
              style={{
                fontSize: '1.08rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Cierre Automático
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Bloqueo estricto antes del pitido inicial de cada partido para garantizar total juego
              limpio.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ margin: '45px 0 30px', textAlign: 'center' }}>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 'clamp(1.4rem, 2.8vw, 1.9rem)',
            color: '#fff',
            marginBottom: '20px',
          }}
        >
          ¿Cómo empezar en 3 pasos?
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            textAlign: 'center',
          }}
        >
          <div className="glass-panel" style={{ padding: '18px 14px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent-cyan, #00d2d3)',
                color: '#0f172a',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                fontSize: '0.95rem',
              }}
            >
              1
            </div>
            <h4 style={{ color: '#fff', marginBottom: '4px', fontSize: '0.98rem' }}>
              Inicia Sesión
            </h4>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.84rem', margin: 0 }}>
              Identifícate con tu cuenta de Google en un solo clic.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '18px 14px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent-cyan, #00d2d3)',
                color: '#0f172a',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                fontSize: '0.95rem',
              }}
            >
              2
            </div>
            <h4 style={{ color: '#fff', marginBottom: '4px', fontSize: '0.98rem' }}>
              Crea o Únete
            </h4>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.84rem', margin: 0 }}>
              Crea una liga para tus amigos o introduce su código de invitación.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '18px 14px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent-cyan, #00d2d3)',
                color: '#0f172a',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                fontSize: '0.95rem',
              }}
            >
              3
            </div>
            <h4 style={{ color: '#fff', marginBottom: '4px', fontSize: '0.98rem' }}>
              Pronostica y Compite
            </h4>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.84rem', margin: 0 }}>
              Rellena tus resultados, sigue los partidos en vivo y lidera la clasificación.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: '45px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#64748b',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚽</span>
          <strong style={{ color: '#fff' }}>PorrApp</strong>
          <span>· Porras Deportivas</span>
        </div>
      </footer>
    </div>
  );
}
