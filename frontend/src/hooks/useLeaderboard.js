import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import html2canvas from 'html2canvas';
import { acceptGroupBet, deleteGroupBet } from '../services/api';

export function useLeaderboard() {
  const state = useAppContext();
  const { leaderboardData, loading, isRaclos, activeGroupName, activeGroupId, activeGroupAdminId, userId, userName } = state;
  const [sharing, setSharing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState('total');
  const [sortDirection, setSortDirection] = useState('desc');

  const isLeagueAdmin = activeGroupAdminId?.toString() === userId?.toString() || state.activeGroupAdmin === userName;

  const results = leaderboardData.map(backendScore => ({
    key: backendScore.id,
    id: backendScore.id,
    userId: backendScore.userId,
    name: backendScore.name || 'Anónimo',
    betName: backendScore.betName || '',
    points: backendScore,
    paid: !backendScore.pending,
    thirdPlaceMatch: backendScore.thirdPlaceMatch,
    thirdPlaceWinner: backendScore.thirdPlaceWinner
  }));

  const col = sortColumn || 'total';

  // 1. Siempre ordenamos primero de mayor a menor (descendente) para calcular rangos y medallas correctamente
  results.sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? -1 : 1;
    const valA = Number(a.points[col]) || 0;
    const valB = Number(b.points[col]) || 0;
    if (valB !== valA) return valB - valA;
    if (col !== 'total') return b.points.total - a.points.total;
    return 0;
  });

  let currentRank = 1;
  let previousVal = null;

  results.forEach((r) => {
    if (r.paid) {
      const val = Number(r.points[col]) || 0;
      if (previousVal !== null && val !== previousVal) {
        currentRank++;
      }
      r.rank = currentRank;
      previousVal = val;
    } else {
      r.rank = '-';
    }
  });

  let lowestPaidRank = 1;
  results.forEach(r => {
    if (r.paid && typeof r.rank === 'number' && r.rank > lowestPaidRank) {
      lowestPaidRank = r.rank;
    }
  });

  // 2. Si el usuario ha pedido orden ascendente (de menor a mayor), reordenamos el array manteniendo las posiciones/rangos reales
  if (sortDirection === 'asc') {
    results.sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? -1 : 1;
      const valA = Number(a.points[col]) || 0;
      const valB = Number(b.points[col]) || 0;
      if (valB !== valA) return valA - valB;
      if (col !== 'total') return a.points.total - b.points.total;
      return 0;
    });
  }

  const handleShare = async () => {
    setSharing(true);
    try {
      const template = document.getElementById('share-image-template');
      const canvas = await html2canvas(template, {
        backgroundColor: '#0f0f1a',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const imgData = canvas.toDataURL('image/png');
      const fetchRes = await fetch(imgData);
      const blob = await fetchRes.blob();
      const file = new File([blob], 'Clasificacion_Porra.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const link = document.createElement('a');
        link.download = 'Clasificacion_Porra_Mundial.png';
        link.href = imgData;
        link.click();
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar la imagen para compartir");
    } finally {
      setSharing(false);
    }
  };

  const handleAcceptBet = async (betId) => {
    if (!window.confirm("¿Confirmar que este jugador ha pagado / es aceptado en la liga?")) return;
    setActionLoading(true);
    try {
      await acceptGroupBet(activeGroupId, betId);
      state.fetchData();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBet = async (betId) => {
    if (!window.confirm("¿Estás seguro de ELIMINAR esta porra? Esta acción no se puede deshacer.")) return;
    setActionLoading(true);
    try {
      await deleteGroupBet(activeGroupId, betId);
      state.fetchData();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  return {
    state,
    results,
    loading,
    isRaclos,
    activeGroupName,
    userId,
    userName,
    isLeagueAdmin,
    lowestPaidRank,
    sharing,
    actionLoading,
    handleShare,
    handleAcceptBet,
    handleDeleteBet,
    validResults: results.filter(r => r.paid),
    sortColumn,
    sortDirection,
    handleSort
  };
}
