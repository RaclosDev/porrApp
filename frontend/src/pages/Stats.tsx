import { useState, useEffect, type ReactNode } from 'react';
import type { StatEntry } from '../hooks/useStatsData';

/** Detalle de una barra: quién eligió esa opción. */
interface StatModal {
  title: string;
  users: string[];
  percentage: number;
  count: number;
  isTwins: boolean;
}

/** Tarjeta abierta con la lista completa. */
interface ExpandedCard {
  title: string;
  icon: ReactNode;
  dataList: StatEntry[];
  color: string;
  isFinals: boolean;
}
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
  const [modalData, setModalData] = useState<StatModal | null>(null);
  const [expandedCard, setExpandedCard] = useState<ExpandedCard | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
            <div key={i} className="skeleton-card flex-1 min-w-75">
              <div className="skeleton skeleton-text medium h-5" />
              {Array.from({ length: 5 }).map((_, j) => (
                <div className="mb-3" key={j}>
                  <div className="skeleton-row mb-1.5">
                    <div className="skeleton skeleton-avatar" />
                    <div className="skeleton skeleton-bar max-w-30" />
                    <div className="skeleton w-7.5 h-3 rounded-[4px] ml-auto" />
                  </div>
                  <div className="skeleton w-full h-2.5 rounded-[10px]" />
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
  }: {
    name: string;
    usersArray: string[];
    total: number;
    icon?: ReactNode;
    isFinals?: boolean;
    color?: string;
    overridePercentage?: number;
  }) => {
    let flagHtml = null;
    let cleanName: ReactNode = name;
    const isTwins = Boolean(name) && name.includes(' 🤝 ');

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
        className="cursor-pointer mb-[15px]"
        role="button"
        tabIndex={0}
        onClick={() => setModalData({ title: name, users: usersArray, percentage, count, isTwins })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setModalData({ title: name, users: usersArray, percentage, count, isTwins });
          }
        }}
        aria-label={`Ver detalles de ${name}`}
      >
        <div className="flex justify-between mb-1.5 text-[0.95rem]">
          <div className="flex items-center font-bold">
            {icon && <span className="mr-2">{icon}</span>}
            {flagHtml}
            {cleanName}
          </div>
          <div className="text-muted text-[0.9rem]">
            <span className="text-white font-bold">{percentage}%</span> {!isTwins && `(${count})`}
          </div>
        </div>
        <div className="w-full bg-[rgba(255,255,255,0.05)] rounded-[10px] h-2.5 overflow-hidden">
          <div
            className="h-full rounded-[10px] [transition:width_0.4s_ease]"
            style={{ width: `${percentage}%`, background: color }}
          />
        </div>
      </div>
    );
  };

  const renderCard = (
    title: string,
    icon: ReactNode,
    dataList: StatEntry[],
    color: string,
    isFinals = false,
  ) => {
    const top5 = dataList.slice(0, 5);
    const hasMore = dataList.length > 5;

    return (
      <div
        className="group-card flex-1 min-w-75 bg-[rgba(20,20,35,0.8)] p-[25px]"
        style={{ border: `1px solid ${color}40`, borderRadius: '16px' }}
      >
        <h3
          className={`mt-0 mb-5 flex items-center gap-2.5 text-[1.2rem] ${hasMore ? 'cursor-pointer' : 'cursor-default'}`}
          role={hasMore ? 'button' : undefined}
          tabIndex={hasMore ? 0 : undefined}
          onClick={() => hasMore && setExpandedCard({ title, icon, dataList, color, isFinals })}
          onKeyDown={(e) => {
            if (hasMore && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setExpandedCard({ title, icon, dataList, color, isFinals });
            }
          }}
          style={{ color: color }}
          aria-label={hasMore ? `Expandir ${title}` : undefined}
        >
          {icon} {title}
        </h3>
        <div className="flex flex-col">
          {dataList.length === 0 ? (
            <div className="text-[rgba(255,255,255,0.3)] italic text-center py-5 px-0">
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
                  className="glass-btn mt-2.5 p-2.5 text-[0.9rem] bg-[rgba(255,255,255,0.05)] w-full"
                  style={{ color: color, borderColor: `${color}40` }}
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
      <div className="section-header mb-10">
        <h2 className="text-cyan text-[2.5rem] mt-0 mb-2.5 mx-0">Estadísticas Globales</h2>
        <p className="text-[1.1rem] text-muted">
          Análisis de las {stats.total} porras registradas en el servidor.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,_minmax(320px,_1fr))] gap-[25px] mt-5">
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
          className="modal flex z-[999990]"
          role="dialog"
          aria-modal="true"
          aria-label={expandedCard.title}
          onClick={() => setExpandedCard(null)}
        >
          <div
            className="modal-content max-w-125 w-[90%] p-0 overflow-hidden bg-[#1e293b] flex flex-col max-h-[80vh]"
            style={{ border: `1px solid ${expandedCard.color}40` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[rgba(0,0,0,0.3)] p-5 border-b border-b-[rgba(255,255,255,0.05)] text-center shrink-0">
              <h3
                className="m-0 text-[1.4rem] flex items-center justify-center gap-2.5"
                style={{ color: expandedCard.color }}
              >
                {expandedCard.icon} {expandedCard.title}
              </h3>
            </div>
            <div className="p-5 overflow-y-auto grow">
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
            <div className="py-[15px] px-5 bg-[rgba(0,0,0,0.2)] flex justify-center shrink-0">
              <button
                onClick={() => setExpandedCard(null)}
                className="glass-btn primary-btn w-full p-3 text-[1.05rem]"
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
          className="modal flex z-[999999]"
          role="dialog"
          aria-modal="true"
          aria-label={modalData.title}
          onClick={() => setModalData(null)}
        >
          <div
            className="modal-content max-w-100 p-0 overflow-hidden bg-[#1e293b] border border-[rgba(255,255,255,0.1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[rgba(0,0,0,0.3)] py-[25px] px-5 border-b border-b-[rgba(255,255,255,0.05)] text-center">
              <h3 className="text-white mt-0 mb-2.5 mx-0 text-[1.4rem]">{modalData.title}</h3>
              <div className="inline-block bg-[rgba(0,_210,_211,_0.1)] text-cyan py-1.5 px-3.5 rounded-[10px] font-bold">
                {modalData.percentage}% de los votos ({modalData.count} personas)
              </div>
            </div>
            <ul className="list-none py-2.5 px-0 m-0 max-h-87.5 overflow-y-auto">
              {modalData.users.map((u, i) => (
                <li className="py-3 px-[25px] flex items-center" key={i}>
                  <span className="text-cyan mr-2.5">•</span>
                  <span className="text-white font-medium">{u}</span>
                </li>
              ))}
            </ul>
            <div className="py-[15px] px-5 bg-[rgba(0,0,0,0.2)] flex justify-center">
              <button
                onClick={() => setModalData(null)}
                className="glass-btn primary-btn w-full p-3 text-[1.05rem]"
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
