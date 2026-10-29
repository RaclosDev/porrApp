import React from 'react';

export default function Landing() {
  return (
    <div className="landing-page max-w-300 my-0 mx-auto pt-5 pb-15 px-4">
      {/* Hero Section */}
      <section className="text-center pt-12.5 pb-10 px-5 flex flex-col items-center gap-5">
        <h1
          className="text-[clamp(2.2rem,_5vw,_3.8rem)] font-extrabold leading-[1.15] tracking-[-0.5px] text-white max-w-212.5 my-0 mx-auto"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          La porra de toda la vida,{' '}
          <span
            className="bg-[linear-gradient(135deg,_#00d2d3_0%,_#38bdf8_100%)]"
            style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            pero bien hecha.
          </span>
        </h1>

        <div className="flex flex-wrap justify-center gap-[8px_12px] max-w-162.5 mt-2 mb-0 mx-auto py-0 px-2.5">
          {[
            { icon: '🏆', text: '+10 Competiciones' },
            { icon: '⚡', text: 'Puntos en tiempo real' },
            { icon: '👥', text: 'Ligas con amigos' },
            { icon: '❌', text: 'Cero líos de Excel' },
          ].map((item) => (
            <div
              className="inline-flex items-center gap-2 py-[7px] px-3.5 bg-[rgba(255,_255,_255,_0.05)] border border-[rgba(255,_255,_255,_0.1)] rounded-[9999px] text-[clamp(0.85rem,_2vw,_0.95rem)] text-[#e2e8f0] font-medium [backdrop-filter:blur(8px)] shadow-[0_2px_10px_rgba(0,_0,_0,_0.15)]"
              key={item.text}
            >
              <span className="text-[1rem] leading-[1]">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-[15px] justify-center items-center flex-wrap mt-[15px]">
          <button
            id="btn-hero-login"
            onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
            className="glass-btn primary-btn py-3.5 px-7 text-[1.05rem] font-extrabold min-h-12.5 rounded-[12px] cursor-pointer inline-flex items-center gap-2.5 shadow-[0_8px_25px_rgba(0,_210,_211,_0.3)]"
          >
            <span>⚽</span>
            <span>Empezar a Jugar</span>
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="mt-[45px] mb-[25px] mx-0">
        <div className="text-center mb-7">
          <h2
            className="text-[clamp(1.5rem,_3.2vw,_2.1rem)] text-white mb-2"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Todo lo que necesitas para tu porra
          </h2>
          <p className="text-muted text-[0.95rem] max-w-140 my-0 mx-auto">
            Sin líos de Excel ni hojas de cálculo. Todo automatizado para competir con tus amigos.
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,_minmax(260px,_1fr))] gap-4">
          {/* Feature 1 */}
          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(251,_191,_36,_0.15)] text-[#fbbf24] flex items-center justify-center text-[1.3rem]">
              🏆
            </div>
            <h3
              className="text-[1.08rem] text-white m-0"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Cuadros Eliminatorios
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Árbol visual interactivo hasta la Gran Final con cruces automáticos, desempates y
              Pichichi.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(0,_210,_211,_0.15)] text-[#00d2d3] flex items-center justify-center text-[1.3rem]">
              ⚽
            </div>
            <h3
              className="text-[1.08rem] text-white m-0"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Ligas por Jornadas
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Para LaLiga, Premier y Champions. Pronósticos fecha a fecha con marcadores al minuto.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(56,_189,_248,_0.15)] text-[#38bdf8] flex items-center justify-center text-[1.3rem]">
              👥
            </div>
            <h3
              className="text-[1.08rem] text-white m-0"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Ligas Privadas
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Crea tu liga en 10 segundos e invita a tus amigos por WhatsApp con un simple enlace.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(168,_85,_247,_0.15)] text-[#a855f7] flex items-center justify-center text-[1.3rem]">
              📊
            </div>
            <h3
              className="text-[1.08rem] text-white m-0"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Directo y Clasificación
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Tabla de posiciones en tiempo real, desglose detallado de puntos y evolución del
              ranking.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(34,_197,_94,_0.15)] text-[#22c55e] flex items-center justify-center text-[1.3rem]">
              📱
            </div>
            <h3
              className="text-[1.08rem] text-white m-0"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              App Instalable (PWA)
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Instálala en tu móvil iOS o Android con un toque para consultar los partidos en
              cualquier lugar.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(239,_68,_68,_0.15)] text-[#ef4444] flex items-center justify-center text-[1.3rem]">
              🔒
            </div>
            <h3
              className="text-[1.08rem] text-white m-0"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Cierre Automático
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Bloqueo estricto antes del pitido inicial de cada partido para garantizar total juego
              limpio.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-[45px] mb-7.5 mx-0 text-center">
        <h2
          className="text-[clamp(1.4rem,_2.8vw,_1.9rem)] text-white mb-5"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          ¿Cómo empezar en 3 pasos?
        </h2>

        <div className="grid grid-cols-[repeat(auto-fit,_minmax(220px,_1fr))] gap-4 text-center">
          <div className="glass-panel py-4.5 px-3.5">
            <div className="w-8 h-8 rounded-full bg-cyan text-[#0f172a] font-extrabold flex items-center justify-center mt-0 mb-2.5 mx-auto text-[0.95rem]">
              1
            </div>
            <h4 className="text-white mb-1 text-[0.98rem]">Inicia Sesión</h4>
            <p className="text-muted text-[0.84rem] m-0">
              Identifícate con tu cuenta de Google en un solo clic.
            </p>
          </div>

          <div className="glass-panel py-4.5 px-3.5">
            <div className="w-8 h-8 rounded-full bg-cyan text-[#0f172a] font-extrabold flex items-center justify-center mt-0 mb-2.5 mx-auto text-[0.95rem]">
              2
            </div>
            <h4 className="text-white mb-1 text-[0.98rem]">Crea o Únete</h4>
            <p className="text-muted text-[0.84rem] m-0">
              Crea una liga para tus amigos o introduce su código de invitación.
            </p>
          </div>

          <div className="glass-panel py-4.5 px-3.5">
            <div className="w-8 h-8 rounded-full bg-cyan text-[#0f172a] font-extrabold flex items-center justify-center mt-0 mb-2.5 mx-auto text-[0.95rem]">
              3
            </div>
            <h4 className="text-white mb-1 text-[0.98rem]">Pronostica y Compite</h4>
            <p className="text-muted text-[0.84rem] m-0">
              Rellena tus resultados, sigue los partidos en vivo y lidera la clasificación.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-[45px] pt-5 border-t border-t-[rgba(255,_255,_255,_0.08)] flex justify-center items-center text-[#94a3b8] text-[0.85rem]">
        <div className="flex items-center gap-2">
          <span>⚽</span>
          <strong className="text-white">PorrApp</strong>
          <span>· Porras Deportivas</span>
        </div>
      </footer>
    </div>
  );
}
