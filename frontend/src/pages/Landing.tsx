import React from 'react';

export default function Landing() {
  return (
    <div className="landing-page max-w-300 my-0 mx-auto pt-5 pb-15 px-4">
      <section className="text-center pt-12.5 pb-10 px-5 flex flex-col items-center gap-5">
        <h1 className="text-[clamp(2.2rem,_5vw,_3.8rem)] font-extrabold leading-[1.15] tracking-[-0.5px] text-white max-w-212.5 my-0 mx-auto font-['Outfit',sans-serif]">
          La porra de toda la vida, <span className="text-cyan">pero bien hecha.</span>
        </h1>

        <div className="flex flex-wrap justify-center gap-[8px_12px] max-w-162.5 mt-2 mb-0 mx-auto py-0 px-2.5">
          {[
            '+10 competiciones',
            'Puntos en tiempo real',
            'Ligas con amigos',
            'Cero líos de Excel',
          ].map((text) => (
            <div
              className="inline-flex items-center py-[7px] px-3.5 bg-[rgba(255,_255,_255,_0.05)] bg-none border border-[rgba(255,_255,_255,_0.1)] rounded-[9999px] text-[clamp(0.85rem,_2vw,_0.95rem)] text-[#e2e8f0] font-medium"
              key={text}
            >
              {text}
            </div>
          ))}
        </div>

        <div className="flex gap-[15px] justify-center items-center flex-wrap mt-[15px]">
          <button
            id="btn-hero-login"
            onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
            className="glass-btn primary-btn py-3.5 px-7 text-[1.05rem] font-extrabold min-h-12.5 rounded-[12px] cursor-pointer inline-flex items-center gap-2.5 shadow-[0_8px_25px_rgba(0,_210,_211,_0.3)]"
          >
            <span>⚽</span>
            <span>Entrar con Google</span>
          </button>
        </div>
      </section>

      <section className="mt-[45px] mb-[25px] mx-0">
        <div className="text-center mb-7">
          <h2 className="text-[clamp(1.5rem,_3.2vw,_2.1rem)] text-white mb-2 font-['Outfit',sans-serif]">
            Qué puedes hacer
          </h2>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,_minmax(260px,_1fr))] gap-4">
          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(251,_191,_36,_0.15)] bg-none text-[#fbbf24] flex items-center justify-center text-[1.3rem]">
              🏆
            </div>
            <h3 className="text-[1.08rem] text-white m-0 font-['Outfit',sans-serif]">
              Cuadros eliminatorios
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Rellena el cuadro hasta la final; cruces y desempates se calculan solos.
            </p>
          </div>

          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(0,_210,_211,_0.15)] bg-none text-[#00d2d3] flex items-center justify-center text-[1.3rem]">
              ⚽
            </div>
            <h3 className="text-[1.08rem] text-white m-0 font-['Outfit',sans-serif]">
              Ligas por jornadas
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Para LaLiga, Premier y Champions. Pronósticos jornada a jornada con el marcador en
              directo.
            </p>
          </div>

          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(56,_189,_248,_0.15)] bg-none text-[#38bdf8] flex items-center justify-center text-[1.3rem]">
              👥
            </div>
            <h3 className="text-[1.08rem] text-white m-0 font-['Outfit',sans-serif]">
              Ligas privadas
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Crea tu liga e invita a tus amigos por WhatsApp con un enlace.
            </p>
          </div>

          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(168,_85,_247,_0.15)] bg-none text-[#a855f7] flex items-center justify-center text-[1.3rem]">
              📊
            </div>
            <h3 className="text-[1.08rem] text-white m-0 font-['Outfit',sans-serif]">
              Directo y clasificación
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Clasificación en directo con el desglose de puntos y su evolución.
            </p>
          </div>

          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(34,_197,_94,_0.15)] bg-none text-[#22c55e] flex items-center justify-center text-[1.3rem]">
              📱
            </div>
            <h3 className="text-[1.08rem] text-white m-0 font-['Outfit',sans-serif]">
              App instalable (PWA)
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Instálala en el móvil como una app.
            </p>
          </div>

          <div className="glass-panel p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-[10px] bg-[rgba(239,_68,_68,_0.15)] bg-none text-[#ef4444] flex items-center justify-center text-[1.3rem]">
              🔒
            </div>
            <h3 className="text-[1.08rem] text-white m-0 font-['Outfit',sans-serif]">
              Cierre automático
            </h3>
            <p className="text-muted text-[0.86rem] leading-[1.45] m-0">
              Los pronósticos se cierran solos antes de empezar.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-[45px] mb-7.5 mx-0 text-center">
        <h2 className="text-[clamp(1.4rem,_2.8vw,_1.9rem)] text-white mb-5 font-['Outfit',sans-serif]">
          ¿Cómo empezar en 3 pasos?
        </h2>

        <div className="grid grid-cols-[repeat(auto-fit,_minmax(220px,_1fr))] gap-4 text-center">
          <div className="glass-panel py-4.5 px-3.5">
            <div className="w-8 h-8 rounded-full bg-cyan bg-none text-[#0f172a] font-extrabold flex items-center justify-center mt-0 mb-2.5 mx-auto text-[0.95rem]">
              1
            </div>
            <h4 className="text-white mb-1 text-[0.98rem]">Inicia sesión</h4>
            <p className="text-muted text-[0.84rem] m-0">
              Identifícate con tu cuenta de Google en un solo clic.
            </p>
          </div>

          <div className="glass-panel py-4.5 px-3.5">
            <div className="w-8 h-8 rounded-full bg-cyan bg-none text-[#0f172a] font-extrabold flex items-center justify-center mt-0 mb-2.5 mx-auto text-[0.95rem]">
              2
            </div>
            <h4 className="text-white mb-1 text-[0.98rem]">Crea o únete</h4>
            <p className="text-muted text-[0.84rem] m-0">
              Crea una liga para tus amigos o introduce su código de invitación.
            </p>
          </div>

          <div className="glass-panel py-4.5 px-3.5">
            <div className="w-8 h-8 rounded-full bg-cyan bg-none text-[#0f172a] font-extrabold flex items-center justify-center mt-0 mb-2.5 mx-auto text-[0.95rem]">
              3
            </div>
            <h4 className="text-white mb-1 text-[0.98rem]">Pronostica y compite</h4>
            <p className="text-muted text-[0.84rem] m-0">
              Rellena tus resultados, sigue los partidos en vivo y lidera la clasificación.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-[45px] pt-5 border-t border-t-[rgba(255,_255,_255,_0.08)] flex justify-center items-center text-[#94a3b8] text-[0.85rem]">
        <div className="flex items-center gap-2">
          <span>⚽</span>
          <strong className="text-white">PorrApp</strong>
          <span>· Porras deportivas</span>
        </div>
      </footer>
    </div>
  );
}
