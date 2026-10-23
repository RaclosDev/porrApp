import { useQueryClient } from '@tanstack/react-query';
import { getAdminToken, updateBet } from '../services/api';

export function useAdminActions() {
  const queryClient = useQueryClient();

  const refreshAll = () => queryClient.invalidateQueries();

  const deleteBet = async (key) => {
    if (window.confirm('¿Estás seguro de que quieres borrar esta porra?')) {
      try {
        const token = getAdminToken();
        const response = await fetch(`/api/predictions/${key}`, {
          method: 'DELETE',
          headers: { ...(token && { Authorization: `Bearer ${token}`, 'X-Admin-Token': token }) },
        });
        if (response.ok) {
          alert('Porra eliminada con éxito.');
          refreshAll();
        } else {
          alert('Error al borrar la porra.');
        }
      } catch (e) {
        alert('Error al borrar: ' + e.message);
      }
    }
  };

  const fixThird = async (key, id, winner) => {
    if (!window.confirm('¿Asignar a ' + winner + ' como ganador del 3º Puesto para esta porra?'))
      return;
    try {
      const res = await fetch(`/api/predictions/${key}`);
      if (!res.ok) throw new Error('Error fetching bet');
      const part = await res.json();

      part.thirdPlaceWinner = winner;

      const response = await updateBet(key, part);
      if (response.ok) {
        alert('Tercer puesto fijado correctamente.');
        refreshAll();
      } else {
        alert('Error al fijar el tercer puesto.');
      }
    } catch (e) {
      alert('Error de red: ' + e.message);
    }
  };

  const acceptBet = async (key) => {
    try {
      const token = getAdminToken();
      const response = await fetch(`/api/predictions/${key}/pay`, {
        method: 'PUT',
        headers: { ...(token && { Authorization: `Bearer ${token}`, 'X-Admin-Token': token }) },
      });
      if (response.ok) {
        alert('¡Porra confirmada! Ahora contará en la clasificación.');
        refreshAll();
      } else {
        alert('Error al confirmar la porra.');
      }
    } catch (e) {
      alert('Error al confirmar: ' + e.message);
    }
  };

  const editBetName = async (key) => {
    try {
      const res = await fetch(`/api/predictions/${key}`);
      if (!res.ok) throw new Error('Error fetching bet');
      const decoded = await res.json();

      const newUserName = window.prompt('Edita el nombre del jugador:', decoded.user || '');
      if (!newUserName || newUserName.trim() === '') return;

      decoded.user = newUserName.trim();

      const response = await updateBet(key, decoded);
      if (response.ok) {
        alert('Nombre y porra actualizados.');
        refreshAll();
      } else {
        alert('Error al guardar en el servidor.');
      }
    } catch (e) {
      alert('Error de red: ' + e.message);
    }
  };

  return {
    deleteBet,
    fixThird,
    acceptBet,
    editBetName,
    refreshAll,
    deletePrediction: deleteBet,
    acceptPrediction: acceptBet,
    editPredictionName: editBetName,
  };
}
