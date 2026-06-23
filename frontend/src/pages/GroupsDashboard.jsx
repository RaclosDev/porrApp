import { useState, useEffect } from 'react';
import { fetchMyGroups, createGroup, joinGroup, fetchGroup, leaveGroup, fetchCompetitions, updateGroup, deleteGroup } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const BET_MODES = [
  { id: 'FULL_BRACKET', label: 'Completa (Fase de grupos y cruces)' },
  { id: 'KNOCKOUTS_ONLY', label: 'Bracket (Solo Cuadro Final)' },
  { id: 'MATCH_DAY', label: 'Por Jornadas' }
];

export default function GroupsDashboard() {
  const [groups, setGroups] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [selectedBetMode, setSelectedBetMode] = useState('');
  const [includePichichi, setIncludePichichi] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [visibleCodes, setVisibleCodes] = useState(new Set());
  const { changeGroup, userName, userId, activeGroupId } = useAppContext();
  const navigate = useNavigate();

  const loadGroupsAndCompetitions = async () => {
    setLoading(true);
    try {
      const [myGroups, comps] = await Promise.all([
        fetchMyGroups(),
        fetchCompetitions().catch(() => [])
      ]);
      
      setCompetitions(comps);
      if (comps.length > 0) setSelectedCompetition(comps[0].id.toString());
      setSelectedBetMode(BET_MODES[0].id);

      // Merge with localStorage known groups that might not have bets yet
      const knownIds = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const missingIds = knownIds.filter(id => !myGroups.find(g => g.id.toString() === id.toString()));
      
      if (missingIds.length > 0) {
        try {
            const extraGroups = await Promise.all(missingIds.map(id => fetchGroup(id).catch(() => null)));
            const validExtras = extraGroups.filter(g => g !== null && g !== undefined);
            myGroups.push(...validExtras);
        } catch(err) {}
      }
      // Auto-seleccionar la única liga disponible
      if (myGroups.length === 1) {
        const onlyGroupId = myGroups[0].id.toString();

        if (activeGroupId !== onlyGroupId) {
          changeGroup(onlyGroupId);
        }
      }
      setGroups(myGroups);
    } catch (e) {
      console.error(e);
      setError('Error al cargar datos');
    }
    setLoading(false);
  };

  useEffect(() => {
    const checkPendingJoin = async () => {
      const pendingCode = localStorage.getItem('pendingJoinCode');
      if (pendingCode) {
        localStorage.removeItem('pendingJoinCode');
        try {
          const group = await joinGroup(pendingCode);
          const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
          if (!knownGroups.includes(group.id.toString())) {
              knownGroups.push(group.id.toString());
              localStorage.setItem('knownGroups', JSON.stringify(knownGroups));
          }
          alert(`¡Te has unido correctamente a la liga "${group.name}" a través de la invitación!`);
          changeGroup(group.id.toString());
          navigate('/bracket');
        } catch (e) {
          setError(e.message);
        }
      } else {
        loadGroupsAndCompetitions();
      }
    };

    if (userName) {
      checkPendingJoin();
    } else {
      setLoading(false);
    }
  }, [userName]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !selectedCompetition || !selectedBetMode) return;
    try {
      const group = await createGroup(newGroupName, selectedCompetition, selectedBetMode, includePichichi);
      setNewGroupName('');
      changeGroup(group.id.toString());
      loadGroupsAndCompetitions();
    } catch (e) {
      setError(e.message || 'Error al crear el grupo');
    }
  };

  const handleEditGroup = async (groupId, currentName) => {
    const newName = prompt('Introduce el nuevo nombre para la liga:', currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    
    try {
      await updateGroup(groupId, newName);
      loadGroupsAndCompetitions();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!window.confirm(`⚠️ ADVERTENCIA ⚠️\n¿Estás seguro de que quieres BORRAR POR COMPLETO la liga "${groupName}"?\n\nEsta acción eliminará todas las apuestas de todos los participantes y no se puede deshacer.`)) return;
    
    try {
      await deleteGroup(groupId);
      // Remove from localStorage if present
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const updatedKnownGroups = knownGroups.filter(id => id.toString() !== groupId.toString());
      localStorage.setItem('knownGroups', JSON.stringify(updatedKnownGroups));
      
      if (activeGroupId === groupId.toString()) {
         changeGroup(null);
      }
      
      loadGroupsAndCompetitions();
      alert(`La liga "${groupName}" ha sido eliminada permanentemente.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const group = await joinGroup(joinCode);
      
      // Save to localStorage so it doesn't disappear on reload before placing a bet
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      if (!knownGroups.includes(group.id.toString())) {
          knownGroups.push(group.id.toString());
          localStorage.setItem('knownGroups', JSON.stringify(knownGroups));
      }
      
      alert(`¡Te has unido correctamente a la liga "${group.name}"! Ahora rellena y envía tu porra para participar.`);
      changeGroup(group.id.toString());
      navigate('/bracket');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEnterGroup = (groupId) => {
    changeGroup(groupId.toString());
    navigate('/');
  };

  const handleLeaveGroup = async (groupId, groupName) => {
    if (!window.confirm(`¿Estás seguro de que quieres abandonar la liga "${groupName}"? Perderás tus apuestas en esta liga.`)) return;
    try {
      await leaveGroup(groupId);
      // Remove from localStorage if present
      const knownGroups = JSON.parse(localStorage.getItem('knownGroups') || '[]');
      const updatedKnownGroups = knownGroups.filter(id => id.toString() !== groupId.toString());
      localStorage.setItem('knownGroups', JSON.stringify(updatedKnownGroups));
      
      loadGroupsAndCompetitions();
      alert(`Has abandonado la liga "${groupName}".`);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleCodeVisibility = (groupId) => {
    setVisibleCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`Código "${code}" copiado al portapapeles.`);
  };

  const handleCopyLink = (code) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
    alert(`Enlace de invitación copiado al portapapeles.`);
  };

  if (!userName) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>Debes iniciar sesión con Google</h2>
        <p style={{ color: 'var(--text-muted)' }}>Para crear o unirte a una liga, necesitas acceder con tu cuenta de Google arriba a la derecha.</p>
      </div>
    );
  }

  return (
    <section className="view-section active">
      <div className="section-header">
        <h2 style={{ margin: 0 }}>Mis Ligas</h2>
      </div>

      {error && (
        <div style={{ background: 'rgba(231, 76, 60, 0.2)', border: '1px solid #e74c3c', color: '#ffcccc', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px', justifyContent: 'center' }}>
        
        <div className="glass-panel" style={{ flex: '1', minWidth: '300px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: 0, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>✨</span> Crear Nueva Liga
          </h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ej: Amigos del Barrio"
              className="glass-input"
            />
            {competitions.length > 0 && (
              <select 
                value={selectedCompetition} 
                onChange={e => setSelectedCompetition(e.target.value)}
                className="glass-input"
              >
                {competitions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <select 
              value={selectedBetMode} 
              onChange={e => setSelectedBetMode(e.target.value)}
              className="glass-input"
            >
              {BET_MODES.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', padding: '8px 12px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', transition: 'all 0.3s' }}>
              <span style={{ fontSize: includePichichi ? '1rem' : '0.9rem', opacity: includePichichi ? 1 : 0.5 }}>{includePichichi ? '🗒️' : '📝'}</span>
              <span>Pichichi</span>
              <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: includePichichi ? 'var(--accent-color)' : 'var(--text-muted)' }}>{includePichichi ? 'SÍ' : 'NO'}</span>
            </label>
            <input type="hidden" name="pichichi" value={includePichichi} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button 
                type="button" 
                onClick={() => setIncludePichichi(true)} 
                className="glass-btn" 
                style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', background: includePichichi ? 'rgba(0, 210, 211, 0.2)' : 'transparent', border: includePichichi ? '1px solid #00d2d3' : '1px solid var(--border-color)', color: includePichichi ? '#00d2d3' : 'var(--text-muted)' }}
              >
                Con Pichichi
              </button>
              <button 
                type="button" 
                onClick={() => setIncludePichichi(false)} 
                className="glass-btn" 
                style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', background: !includePichichi ? 'rgba(255, 71, 87, 0.2)' : 'transparent', border: !includePichichi ? '1px solid #ff4757' : '1px solid var(--border-color)', color: !includePichichi ? '#ff4757' : 'var(--text-muted)' }}
              >
                Sin Pichichi
              </button>
            </div>
            <button type="submit" className="glass-btn primary-btn">
              Crear Liga
            </button>
          </form>
        </div>

        <div className="glass-panel" style={{ flex: '1', minWidth: '300px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: 0, color: '#9b59b6', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🔑</span> Unirse con Código
          </h3>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Código de 6 letras"
              maxLength={6}
              className="glass-input"
              style={{ flex: 1, textTransform: 'uppercase' }}
            />
            <button type="submit" className="glass-btn primary-btn" style={{ background: '#9b59b6', borderColor: '#9b59b6' }}>
              Unirse
            </button>
          </form>
        </div>

      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Cargando tus ligas...</div>
      ) : (
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {groups.map(group => {
            const isCodeVisible = visibleCodes.has(group.id);
            const isSelected = activeGroupId && activeGroupId.toString() === group.id.toString();
            return (
              <div key={group.id} className="glass-panel" style={{ 
                flex: '1', minWidth: '250px', maxWidth: '350px', padding: '20px', position: 'relative', 
                display: 'flex', flexDirection: 'column', gap: '10px',
                border: isSelected ? '2px solid #00d2d3' : '1px solid var(--border-color)',
                boxShadow: isSelected ? '0 0 15px rgba(0, 210, 211, 0.3)' : 'none'
              }}>
                {isSelected && (
                  <div style={{ position: 'absolute', top: '-10px', left: '15px', background: '#00d2d3', color: '#000', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    ★ SELECCIONADA
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', position: 'absolute', top: '15px', right: '15px', alignItems: 'flex-end' }}>
                  <div 
                    onClick={() => toggleCodeVisibility(group.id)}
                    style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    title="Click para mostrar/ocultar código"
                  >
                    Código: <strong style={{ color: 'white', letterSpacing: isCodeVisible ? 'normal' : '2px' }}>{isCodeVisible ? group.joinCode : '••••••'}</strong>
                    <span>{isCodeVisible ? '🙈' : '👁️'}</span>
                  </div>
                  {isCodeVisible && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => handleCopyCode(group.joinCode)} className="glass-btn" style={{ padding: '2px 6px', fontSize: '0.75rem' }} title="Copiar Código">📋 Código</button>
                      <button onClick={() => handleCopyLink(group.joinCode)} className="glass-btn" style={{ padding: '2px 6px', fontSize: '0.75rem' }} title="Copiar Enlace de Invitación">🔗 Enlace</button>
                    </div>
                  )}
                </div>
                <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', paddingRight: '120px' }}>{group.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Admin: <strong>{group.adminParticipantName}</strong>
                </p>
                {group.competitionName && (
                  <p style={{ color: '#a29bfe', fontSize: '0.85rem', margin: '2px 0' }}>
                    {group.competitionName} · {group.betMode === 'FULL_BRACKET' ? 'Completa' : group.betMode === 'KNOCKOUTS_ONLY' ? 'Bracket' : 'Por Jornadas'}
                    <span style={{ color: group.pichichi !== false ? '#00b894' : 'var(--text-muted)' }}> · {group.pichichi !== false ? '🗒️ Pichichi' : 'Sin Pichichi'}</span>
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button 
                    onClick={() => handleEnterGroup(group.id)}
                    className="glass-btn primary-btn"
                    style={{ flex: 1, background: isSelected ? 'rgba(0, 210, 211, 0.2)' : '', border: isSelected ? '1px solid #00d2d3' : '' }}
                    disabled={isSelected}
                  >
                    {isSelected ? 'Liga Actual' : 'Acceder'}
                  </button>
                  {group.adminUserId?.toString() === userId?.toString() && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => handleEditGroup(group.id, group.name)}
                        className="glass-btn"
                        style={{ padding: '8px', fontSize: '0.9rem' }}
                        title="Editar Nombre"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="glass-btn"
                        style={{ padding: '8px', fontSize: '0.9rem', background: 'rgba(231, 76, 60, 0.2)', border: '1px solid #e74c3c' }}
                        title="Borrar Liga"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                  {group.adminUserId?.toString() !== userId?.toString() && (
                    <button 
                      onClick={() => handleLeaveGroup(group.id, group.name)}
                      className="glass-btn"
                      style={{ background: 'rgba(231, 76, 60, 0.2)', border: '1px solid #e74c3c', color: '#ffcccc' }}
                      title="Abandonar Liga"
                    >
                      Salir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {groups.length === 0 && (
            <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)', padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              Aún no estás en ninguna liga. Crea una o únete con un código.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
