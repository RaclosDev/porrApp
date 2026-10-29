import toast from 'react-hot-toast';
import { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { acceptGroupPrediction, deleteGroupPrediction } from '../services/api';

const EMPTY_MATCHDAYS = [];

export function useLeaderboard() {
  const state = useAppContext();
  const {
    leaderboardData,
    leaderboardMatchdays,
    loading,
    activeGroupName,
    activeGroupId,
    activeGroupPichichi,
    activeGroupPoolFormat,
    activeGroupBetMode,
    activeGroupAdminId,
    userId,
    userName,
  } = state;
  const [sharing, setSharing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState('total');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedMatchdayState, setSelectedMatchdayState] = useState(null);

  const isLeagueAdmin =
    activeGroupAdminId?.toString() === userId?.toString() || state.activeGroupAdmin === userName;

  const matchdays = Array.isArray(leaderboardMatchdays) ? leaderboardMatchdays : EMPTY_MATCHDAYS;

  const currentMatchday = useMemo(
    () => matchdays.find((matchday) => matchday.current) || matchdays[matchdays.length - 1] || null,
    [matchdays],
  );

  // Sin elección explícita se muestra la jornada actual.
  const selectedMatchdayInfo = useMemo(() => {
    if (selectedMatchdayState === null) return currentMatchday;
    return (
      matchdays.find((matchday) => matchday.label === selectedMatchdayState) || currentMatchday
    );
  }, [selectedMatchdayState, matchdays, currentMatchday]);

  const selectedMatchday = selectedMatchdayInfo?.label || null;
  const matchdayIndex = selectedMatchdayInfo
    ? matchdays.findIndex((matchday) => matchday.label === selectedMatchdayInfo.label)
    : -1;

  const { results, lowestPaidRank, matchdayStats } = useMemo(() => {
    const getMatchdayPoints = (backendScore) => {
      if (!selectedMatchdayInfo || backendScore.id == null) return 0;
      const pointsByPrediction = selectedMatchdayInfo.pointsByPrediction;
      if (!pointsByPrediction) return 0;
      const value =
        pointsByPrediction[backendScore.id] ?? pointsByPrediction[String(backendScore.id)];
      return Number(value) || 0;
    };

    const list = (leaderboardData || []).map((backendScore) => {
      const matchdayPoints = getMatchdayPoints(backendScore);
      return {
        key: backendScore.id ?? `member-${backendScore.userId}`,
        id: backendScore.id,
        userId: backendScore.userId,
        name: backendScore.name || 'Anónimo',
        betName: backendScore.betName || '',
        avatarUrl: backendScore.avatarUrl || '',
        points: { ...backendScore, matchday: matchdayPoints },
        matchdayPoints,
        paid: !backendScore.pending,
        thirdPlaceMatch: backendScore.thirdPlaceMatch,
        thirdPlaceWinner: backendScore.thirdPlaceWinner,
      };
    });

    const col = sortColumn || 'total';

    // Siempre ordenamos primero de mayor a menor (descendente) para calcular rangos y medallas correctamente
    list.sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? -1 : 1;
      const valA = Number(a.points[col]) || 0;
      const valB = Number(b.points[col]) || 0;
      if (valB !== valA) return valB - valA;
      if (col !== 'total') return b.points.total - a.points.total;
      return 0;
    });

    let currentRank = 1;
    let previousVal = null;

    list.forEach((r) => {
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

    let lowestRank = 1;
    list.forEach((r) => {
      if (r.paid && typeof r.rank === 'number' && r.rank > lowestRank) {
        lowestRank = r.rank;
      }
    });

    // Si el usuario ha pedido orden ascendente (de menor a mayor), reordenamos el array manteniendo las posiciones/rangos reales
    if (sortDirection === 'asc') {
      list.sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? -1 : 1;
        const valA = Number(a.points[col]) || 0;
        const valB = Number(b.points[col]) || 0;
        if (valB !== valA) return valA - valB;
        if (col !== 'total') return a.points.total - b.points.total;
        return 0;
      });
    }

    let stats = null;
    if (selectedMatchdayInfo) {
      const paidList = list.filter((r) => r.paid);
      const me = paidList.find(
        (r) => r.userId?.toString() === userId?.toString() || r.name === userName,
      );
      const leader =
        [...paidList]
          .filter((r) => Number(r.points.matchday) > 0)
          .sort(
            (a, b) =>
              Number(b.points.matchday) - Number(a.points.matchday) ||
              Number(b.points.total) - Number(a.points.total),
          )[0] || null;

      stats = {
        myPoints: Number(me?.points.matchday) || 0,
        leader,
      };
    }

    return { results: list, lowestPaidRank: lowestRank, matchdayStats: stats };
  }, [leaderboardData, sortColumn, sortDirection, selectedMatchdayInfo, userId, userName]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      const template = document.getElementById('share-image-template');
      const canvas = await html2canvas(template, {
        backgroundColor: '#0f0f1a',
        scale: 2,
        logging: false,
        useCORS: true,
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
      toast.error('Error al generar la imagen para compartir');
    } finally {
      setSharing(false);
    }
  };

  const handleAcceptPrediction = async (predictionId) => {
    if (!window.confirm('¿Confirmar que este jugador ha pagado / es aceptado en la liga?')) return;
    setActionLoading(true);
    try {
      await acceptGroupPrediction(activeGroupId, predictionId);
      state.fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };
  const handleAcceptBet = handleAcceptPrediction;

  const handleDeletePrediction = async (predictionId) => {
    if (!window.confirm('¿Estás seguro de ELIMINAR esta porra? Esta acción no se puede deshacer.'))
      return;
    setActionLoading(true);
    try {
      await deleteGroupPrediction(activeGroupId, predictionId);
      state.fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };
  const handleDeleteBet = handleDeletePrediction;

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleSelectMatchday = (label) => {
    if (label) setSelectedMatchdayState(label);
  };

  const handleStepMatchday = (direction) => {
    const nextIndex = matchdayIndex + direction;
    if (nextIndex >= 0 && nextIndex < matchdays.length) {
      setSelectedMatchdayState(matchdays[nextIndex].label);
    }
  };

  return {
    state,
    results,
    loading,
    activeGroupName,
    activeGroupId,
    activeGroupPichichi,
    activeGroupPoolFormat: activeGroupPoolFormat || activeGroupBetMode,
    activeGroupBetMode,
    userId,
    userName,
    isLeagueAdmin,
    lowestPaidRank,
    sharing,
    actionLoading,
    handleShare,
    handleAcceptBet,
    handleDeleteBet,
    handleAcceptPrediction,
    handleDeletePrediction,
    validResults: results.filter((r) => r.paid),
    sortColumn,
    sortDirection,
    handleSort,
    matchdays,
    currentMatchday,
    selectedMatchday,
    selectedMatchdayInfo,
    matchdayStats,
    matchdayIndex,
    canGoPrevMatchday: matchdayIndex > 0,
    canGoNextMatchday:
      matchdays.length > 0 && (matchdayIndex === -1 || matchdayIndex < matchdays.length - 1),
    handleSelectMatchday,
    handleStepMatchday,
  };
}
