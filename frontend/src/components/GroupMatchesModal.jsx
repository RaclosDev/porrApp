
import { createPortal } from 'react-dom';
import Flag from './Flag';
import { openStats } from '../utils/navigation';

const GroupMatchesModal = ({ selectedGroup, allGames, onClose }) => {
    if (!selectedGroup) return null;

    const groupNames = selectedGroup.teams.map(t => t.name);
    let groupMatches = allGames.filter(g => groupNames.includes(g.home) && groupNames.includes(g.away));
    groupMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

    return createPortal(
        <>
            <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 }} 
                onClick={onClose} 
                className="modal-backdrop-mobile"
            ></div>
            <div 
                className="group-matches-popover"
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: 'var(--accent-color)', textAlign: 'center', flex: 1 }}>Partidos del Grupo {selectedGroup.name}</h4>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.4rem', cursor: 'pointer', position: 'absolute', right: '15px', top: '10px', zIndex: 2 }}>×</button>
                </div>
                <div className="last-matches-grid" style={{ gridTemplateColumns: '1fr', gap: '8px' }}>
                    {groupMatches.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay partidos registrados.</p>
                    ) : (
                        groupMatches.map(m => {
                            const d = new Date(m.date);
                            const dateFormatted = `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                            const hasStarted = new Date() >= d;
                            const hasFinished = m.finished === true;

                            return (
                                <div 
                                    key={m.id} 
                                    onClick={() => openStats(m.home, m.away)}
                                    style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr) 45px minmax(0, 1fr)', gap: '6px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                >
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                        {hasFinished ? '✔️' : '🕒'} {dateFormatted}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', textAlign: 'right' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.home}</span> 
                                        <Flag team={m.home} />
                                    </div>
                                    <div style={{ padding: '2px 0', fontWeight: 'bold', textAlign: 'center', color: hasStarted ? 'white' : 'var(--text-muted)', background: hasStarted ? 'rgba(0,0,0,0.3)' : 'transparent', borderRadius: '4px' }}>
                                        {hasStarted ? `${m.homeScore} - ${m.awayScore}` : 'VS'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px' }}>
                                        <Flag team={m.away} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.away}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>,
        document.body
    );
};

export default GroupMatchesModal;
