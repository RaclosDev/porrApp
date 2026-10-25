import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function Landing() {
  const navigate = useNavigate();
  const { enterDemoMode } = useAppContext();

  const handleStartDemo = () => {
    if (enterDemoMode) {
      enterDemoMode();
    }
    navigate('/demo');
  };

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

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '8px auto 0',
            maxWidth: '740px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '10px 20px',
            fontSize: 'clamp(0.95rem, 1.8vw, 1.05rem)',
            color: '#cbd5e1',
            lineHeight: 1.5,
          }}
        >
          <li style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00d2d3', fontWeight: 800 }}>✓</span> Todos los formatos:
            jornadas, liguillas y eliminatorias
          </li>
          <li style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00d2d3', fontWeight: 800 }}>✓</span> Puntos y clasificaciones en
            tiempo real
          </li>
          <li style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00d2d3', fontWeight: 800 }}>✓</span> +10 competiciones (Mundial,
            Champions, LaLiga...)
          </li>
          <li style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00d2d3', fontWeight: 800 }}>✓</span> Ligas privadas para tus
            amigos y cero líos de Excel
          </li>
        </ul>

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
            id="btn-hero-demo"
            onClick={handleStartDemo}
            className="glass-btn primary-btn"
            style={{
              padding: '14px 28px',
              fontSize: '1.05rem',
              fontWeight: 800,
              minHeight: '52px',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 8px 25px rgba(0, 210, 211, 0.3)',
            }}
          >
            <span>🚀</span>
            <span>Explorar Demo del Mundial</span>
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ margin: '50px 0 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <h2
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(1.6rem, 3.5vw, 2.3rem)',
              color: '#fff',
              marginBottom: '10px',
            }}
          >
            Todo lo que necesitas para tu porra de amigos
          </h2>
          <p
            style={{
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '1rem',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            Diseñado para eliminar la fricción manual y ofrecer una experiencia fluida tanto en
            torneos de eliminación como en ligas regulares.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Feature 1 */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'transform 0.2s ease',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(251, 191, 36, 0.15)',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              🏆
            </div>
            <h3
              style={{
                fontSize: '1.15rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Cuadro Eliminatorio (Brackets)
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Árbol visual de eliminatorias desde 32avos hasta la Gran Final. Cruces automáticos
              basados en la fase de grupos, desempate de mejores terceros y pronóstico de Pichichi.
            </p>
          </div>

          {/* Feature 2 */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(0, 210, 211, 0.15)',
                color: '#00d2d3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              ⚽
            </div>
            <h3
              style={{
                fontSize: '1.15rem',
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
                fontSize: '0.9rem',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Para LaLiga EA Sports, Premier League y Champions League. Pronósticos jornada a
              jornada con actualización de marcadores y cálculo de puntos por jornada.
            </p>
          </div>

          {/* Feature 3 */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              👥
            </div>
            <h3
              style={{
                fontSize: '1.15rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Peñas y Grupos Privados
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Crea tu propia liga privada en 10 segundos. Comparte el enlace de invitación con tus
              amigos y gestiona los participantes desde tu propio panel de administración.
            </p>
          </div>

          {/* Feature 4 */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              📊
            </div>
            <h3
              style={{
                fontSize: '1.15rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Clasificación y Estadísticas
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Tabla en tiempo real con desglose detallado de puntos por ronda, aciertos exactos,
              selecciones más votadas por la comunidad y gráfico de evolución.
            </p>
          </div>

          {/* Feature 5 */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              📱
            </div>
            <h3
              style={{
                fontSize: '1.15rem',
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
                fontSize: '0.9rem',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Instálala en tu móvil iOS o Android con un toque. Interfaz ultra-rápida, diseño
              adaptativo optimizado para uso en el sofá o en el bar durante los partidos.
            </p>
          </div>

          {/* Feature 6 */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              🔒
            </div>
            <h3
              style={{
                fontSize: '1.15rem',
                color: '#fff',
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Cierre Automático y Fair Play
            </h3>
            <p
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Bloqueo estricto antes del pitido inicial de cada jornada o torneo para evitar
              modificaciones sospechosas. Total transparencia entre los miembros de tu peña.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ margin: '60px 0 40px', textAlign: 'center' }}>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
            color: '#fff',
            marginBottom: '30px',
          }}
        >
          ¿Cómo empezar en 3 pasos?
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
            textAlign: 'center',
          }}
        >
          <div className="glass-panel" style={{ padding: '24px 20px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent-cyan, #00d2d3)',
                color: '#0f172a',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 15px',
                fontSize: '1.1rem',
              }}
            >
              1
            </div>
            <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '1.05rem' }}>
              Explora o Inicia Sesión
            </h4>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem', margin: 0 }}>
              Prueba la demo del Mundial libremente o identifícate con tu cuenta de Google en dos
              clics.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '24px 20px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent-cyan, #00d2d3)',
                color: '#0f172a',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 15px',
                fontSize: '1.1rem',
              }}
            >
              2
            </div>
            <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '1.05rem' }}>
              Únete o Crea tu Liga
            </h4>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem', margin: 0 }}>
              Crea una liga para tu peña o introduce el código de invitación que te hayan enviado
              tus amigos.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '24px 20px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent-cyan, #00d2d3)',
                color: '#0f172a',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 15px',
                fontSize: '1.1rem',
              }}
            >
              3
            </div>
            <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '1.05rem' }}>
              Pronostica y Compite
            </h4>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem', margin: 0 }}>
              Rellena tu cuadro o tus jornadas, sigue los resultados en directo y presume de
              liderato.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section
        style={{
          marginTop: '60px',
          padding: '40px 24px',
          borderRadius: '20px',
          background:
            'linear-gradient(135deg, rgba(0, 210, 211, 0.12) 0%, rgba(37, 99, 235, 0.15) 100%)',
          border: '1px solid rgba(0, 210, 211, 0.3)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <h3
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
            color: '#fff',
            margin: 0,
          }}
        >
          ¿Listo para ver la porra en acción?
        </h3>
        <p
          style={{
            color: 'var(--text-muted, #94a3b8)',
            fontSize: '1rem',
            maxWidth: '540px',
            margin: 0,
          }}
        >
          Descubre el cuadro completo del Mundial 2026, las porras de los participantes y el ranking
          interactivo.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '14px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: '10px',
          }}
        >
          <button
            onClick={handleStartDemo}
            className="glass-btn primary-btn"
            style={{
              padding: '12px 24px',
              fontSize: '1rem',
              fontWeight: 800,
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            🚀 Abrir Demo del Mundial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: '60px',
          paddingTop: '25px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          color: '#64748b',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚽</span>
          <strong style={{ color: '#fff' }}>PorrApp</strong>
          <span>· Porras Deportivas</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button
            onClick={handleStartDemo}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Demo Mundial 2026
          </button>
          <button
            onClick={() => navigate('/reglas')}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Reglas del Juego
          </button>
        </div>
      </footer>
    </div>
  );
}
