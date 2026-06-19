import React, { useState, useEffect } from 'react';

const updates = [
  {
    title: "🧠 Nuevo Perfil Psicológico",
    description: "Al buscar el perfil de un jugador, ahora verás sus stats más locas. El motor analiza sus 'Locuras', sus 'Haters'... ¡y te mandamos directo al Psiquiatra si has puesto resultados que NADIE MÁS ha puesto!",
    img: "/updates/update1.png"
  },
  {
    title: "📊 Estadísticas Globales Ampliadas",
    description: "Hemos añadido un montón de nuevas secciones de salseo estadístico: Reyes del Grupo, Caballos Oscuros, Supervivientes y Decepciones. ¡Descubre qué opina la mayoría del grupo!",
    img: "/updates/update2.png"
  },
  {
    title: "👯 Almas Gemelas y Mejoras",
    description: "Hemos cruzado los datos de las 21 porras para encontrar a los mayores 'copiones' del grupo (Almas Gemelas). Además, ahora puedes buscar países escribiendo directamente en los desplegables.",
    img: "/updates/update3.png"
  }
];

const UpdateModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenUpdate_v2');
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < updates.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem('hasSeenUpdate_v2', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const currentUpdate = updates[currentStep];

  return (
    <div className="modal" style={{ display: 'flex', zIndex: 9999999, backdropFilter: 'blur(8px)', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '0', background: '#1e1e2e', border: '1px solid #00d2d3', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 0 30px rgba(0, 210, 211, 0.2)' }}>
        
        {/* Header */}
        <div style={{ background: 'linear-gradient(90deg, var(--accent-color), #00a8ff)', padding: '20px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'black', fontSize: '1.6rem', textShadow: '0 1px 2px rgba(255,255,255,0.3)' }}>
            🔥 ¡Nuevas Novedades! 🔥
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: '30px 20px', textAlign: 'center' }}>
          <h3 style={{ color: 'white', marginTop: 0, marginBottom: '15px', fontSize: '1.3rem' }}>
            {currentUpdate.title}
          </h3>
          
          <img 
            src={currentUpdate.img} 
            alt={currentUpdate.title} 
            style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)' }} 
          />
          
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: '1.5', margin: 0 }}>
            {currentUpdate.description}
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {updates.map((_, idx) => (
              <div 
                key={idx} 
                style={{ 
                  width: '10px', height: '10px', borderRadius: '50%', 
                  background: currentStep === idx ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)',
                  transition: 'background 0.3s'
                }} 
              />
            ))}
          </div>

          <button onClick={handleNext} className="glass-btn primary-btn" style={{ padding: '10px 25px', fontSize: '1.1rem', fontWeight: 'bold' }}>
            {currentStep < updates.length - 1 ? 'Siguiente ➔' : '¡Vamos allá! 🚀'}
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default UpdateModal;
