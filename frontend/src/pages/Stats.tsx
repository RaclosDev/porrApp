import { useState, useEffect } from 'react';
import Flag from '../components/Flag';
import { useStatsData } from '../hooks/useStatsData';
import { useAppContext } from '../context/AppContext';

/**
 * Vista de Estadisticas Globales de la porra.
 * Muestra metricas agregadas de todos los usuarios.
 */
function Stats() {
  const { stats, loading } = useStatsData();
  const { activeGroupPichichi } = useAppContext();
  const [modalData, setModalData] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setExpandedCard(null);
        setModalData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading)
    return (
      <section className="view-section active block">
        <div className="flex flex-wrap gap-5 justify-center">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ flex: 1, minWidth: '300px' }}>
              <div className="skeleton skeleton-text medium" style={{ height: '20px' }} />
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} style={{ marginBottom: '12px' }}>
                  <div className="skeleton-row" style={{ marginBottom: '6px' }}>
                    <div className="skeleton skeleton-avatar" />
                    <div className="skeleton skeleton-bar" style={{ maxWidth: '120px' }} />
                    <div
                      className="skeleton"
                      style={{
                        width: '30px',
                        height: '12px',
                        borderRadius: '4px',
                        marginLeft: 'auto',
                      }}
                    />
                  </div>
                  <div
                    className="skeleton"
                    style={{ width: '100%', height: '10px', borderRadius: '10px' }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    );

  const ProgressBarItem = ({
    name,
    usersArray,
    total,
    icon = null,
    isFinals = false,
    color = 'var(--accent-color)',
    overridePercentage,
  }) => {
    let flagHtml = null;
    let cleanName = name;
    const isTwins = name && typeof name === 'string' && name.includes(' 🤝 ');

    if (isTwins) {
      cleanName = <span>{name}</span>;
    } else if (isFinals) {
      const teams = name.split(' vs ');
      const t1 = teams[0],
        t2 = teams[1];
      const f1 = (
        <Flag
          team={t1}
          size="w80"
          style={{ width: 16, height: 12, objectFit: 'cover', borderRadius: 2 }}
        />
      );
      const f2 = (
        <Flag
          team={t2}
          size="w80"
          style={{ width: 16, height: 12, objectFit: 'cover', borderRadius: 2 }}
        />
      );
      cleanName = (
        <span className="flex items-center gap-1">
          {f1} {t1} <span>vs</span> {t2} {f2}
        </span>
      );
    } else {
      flagHtml = (
        <Flag
          team={name}
          size="w80"
          style={{
            width: 16,
            height: 12,
            objectFit: 'cover',
            marginRight: 8,
            borderRadius: 2,
          }}
        />
      );
    }

    const count = usersArray.length;
    const percentage =
      overridePercentage !== undefined
        ? overridePercentage
        : total > 0
          ? Math.round((count / total) * 100)
          : 0;

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setModalData({ title: name, users: usersArray, percentage, count, isTwins })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setModalData({ title: name, users: usersArray, percentage, count, isTwins });
          }
        }}
        style={{ cursor: 'pointer', marginBottom: '15px' }}
        aria-label={`Ver detalles de ${name}`}
      >
        <div className="flex justify-between mb-1.5 text-[0.95rem]">
          <div className="flex items-center font-bold">
            {icon && <span className="mr-2">{icon}</span>}
            {flagHtml}
            {cleanName}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <span style={{ color: 'white', fontWeight: 'bold' }}>{percentage}%</span>{' '}
            {!isTwins && `(${count})`}
          </div>
        </div>
        <div
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '10px',
            height: '10px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              background: color,
              borderRadius: '10px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    );
  };

  const renderCard = (title, icon, dataList, color, isFinals = false) => {
    const top5 = dataList.slice(0, 5);
    const hasMore = dataList.length > 5;

    return (
      <div
        className="group-card"
        style={{
          flex: 1,
          minWidth: '300px',
          background: 'rgba(20,20,35,0.8)',
          border: `1px solid ${color}40`,
          padding: '25px',
          borderRadius: '16px',
        }}
      >
        <h3
          role={hasMore ? 'button' : undefined}
          tabIndex={hasMore ? 0 : undefined}
          onClick={() => hasMore && setExpandedCard({ title, icon, dataList, color, isFinals })}
          onKeyDown={(e) => {
            if (hasMore && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setExpandedCard({ title, icon, dataList, color, isFinals });
            }
          }}
          style={{
            color: color,
            marginTop: 0,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '1.2rem',
            cursor: hasMore ? 'pointer' : 'default',
          }}
          aria-label={hasMore ? `Expandir ${title}` : undefined}
        >
          {icon} {title}
        </h3>
        <div className="flex flex-col">
          {dataList.length === 0 ? (
            <div
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '20px 0',
              }}
            >
              Sin datos suficientes
            </div>
          ) : (
            <>
              {top5.map(([name, users, override]) => (
                <ProgressBarItem
                  key={name}
                  name={name}
                  usersArray={users}
                  total={stats.total}
                  isFinals={isFinals}
                  color={color}
                  overridePercentage={override}
                />
              ))}
              {hasMore && (
                <button
                  onClick={() => setExpandedCard({ title, icon, dataList, color, isFinals })}
                  className="glass-btn"
                  style={{
                    marginTop: '10px',
                    padding: '10px',
                    fontSize: '0.9rem',
                    color: color,
                    borderColor: `${color}40`,
                    background: 'rgba(255,255,255,0.05)',
                    width: '100%',
                  }}
                >
                  Ver {dataList.length - 5} más
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <section id="view-stats" className="view-section active block">
      <div className="section-header" style={{ marginBottom: '40px' }}>
        <h2 style={{ color: 'var(--accent-cyan)', fontSize: '2.5rem', margin: '0 0 10px 0' }}>
          Estadísticas Globales
        </h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
          Análisis de las {stats.total} porras registradas en el servidor.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '25px',
          marginTop: '20px',
        }}
      >
        {renderCard('Campeón del Mundo', '🏆', stats.champions, '#f1c40f')}
        {renderCard('Subcampeón', '🥈', stats.runnerups, '#95a5a6')}
        {renderCard('Reyes del Grupo (1ºs)', '👑', stats.kings, '#1abc9c')}
        {renderCard('Supervivientes (3ºs)', '🛟', stats.thirds, '#f39c12')}
        {renderCard('Sorpresas (Pasan de Grupo)', '🦄', stats.darkHorses, '#e84393')}
        {renderCard('Llegan a Semifinales', '💫', stats.semis, '#e67e22')}
        {renderCard('Finales Más Repetidas', '⚔️', stats.finals, '#e74c3c', true)}
        {activeGroupPichichi &&
          stats.scorers &&
          stats.scorers.length > 0 &&
          renderCard('Pichichi', '👟', stats.scorers, '#3498db')}
        {renderCard('Decepciones (Caen en Grupos)', '💀', stats.disappointments, '#9b59b6')}
        {renderCard('Almas Gemelas', '👯', stats.twins, '#00d8d6')}
      </div>

      {/* Expanded Card Modal */}
      {expandedCard && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={expandedCard.title}
          style={{ display: 'flex', zIndex: 999990 }}
          onClick={() => setExpandedCard(null)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '500px',
              width: '90%',
              padding: '0',
              overflow: 'hidden',
              background: '#1e293b',
              border: `1px solid ${expandedCard.color}40`,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '20px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              <h3
                style={{
                  color: expandedCard.color,
                  margin: 0,
                  fontSize: '1.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                {expandedCard.icon} {expandedCard.title}
              </h3>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1 }}>
              {expandedCard.dataList.map(([name, users, override]) => (
                <ProgressBarItem
                  key={name}
                  name={name}
                  usersArray={users}
                  total={stats.total}
                  isFinals={expandedCard.isFinals}
                  color={expandedCard.color}
                  overridePercentage={override}
                />
              ))}
            </div>
            <div
              style={{
                padding: '15px 20px',
                background: 'rgba(0,0,0,0.2)',
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setExpandedCard(null)}
                className="glass-btn primary-btn"
                style={{ width: '100%', padding: '12px', fontSize: '1.05rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Detail Modal */}
      {modalData && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={modalData.title}
          style={{ display: 'flex', zIndex: 999999 }}
          onClick={() => setModalData(null)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '400px',
              padding: '0',
              overflow: 'hidden',
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '25px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'center',
              }}
            >
              <h3 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '1.4rem' }}>
                {modalData.title}
              </h3>
              <div
                style={{
                  display: 'inline-block',
                  background: 'rgba(0, 210, 211, 0.1)',
                  color: 'var(--accent-cyan)',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                }}
              >
                {modalData.percentage}% de los votos ({modalData.count} personas)
              </div>
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: '10px 0',
                margin: 0,
                maxHeight: '350px',
                overflowY: 'auto',
              }}
            >
              {modalData.users.map((u, i) => (
                <li key={i} style={{ padding: '12px 25px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent-cyan)', marginRight: '10px' }}>•</span>
                  <span style={{ color: 'white', fontWeight: 500 }}>{u}</span>
                </li>
              ))}
            </ul>
            <div
              style={{
                padding: '15px 20px',
                background: 'rgba(0,0,0,0.2)',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => setModalData(null)}
                className="glass-btn primary-btn"
                style={{ width: '100%', padding: '12px', fontSize: '1.05rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Stats;
