import { useEffect, useRef, useState } from 'react';
import { fetchPrediction } from '../services/api';
import type { PredictionData } from '../types/api';
import { errorMessage } from '../utils/errors';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { ViewerModal } from './prediction/ViewerFrame';

export default function CustomPredictionViewer({
  predictionId,
  onClose,
}: {
  predictionId: string | number;
  onClose: () => void;
}) {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { active: true, onEscape: onClose });

  useEffect(() => {
    let cancelled = false;
    fetchPrediction(predictionId)
      .then((data) => {
        if (!cancelled) setPrediction(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason, 'No se pudo cargar el pronóstico'));
      });
    return () => {
      cancelled = true;
    };
  }, [predictionId]);

  return (
    <ViewerModal
      dialogRef={dialogRef}
      onClose={onClose}
      className="modal-content paper-panel album-sheet landing-tape w-[95vw] max-w-150 max-h-[90vh] overflow-y-auto p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="poster-title m-0">{prediction?.prediction || 'Pronóstico'}</h2>
        <button type="button" className="glass-btn" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[var(--miss)]">
          {error}
        </p>
      )}
      {!prediction && !error && <p role="status">Cargando pronóstico…</p>}
      {prediction?.groups &&
        Object.entries(prediction.groups).map(([group, order]) => (
          <section key={group} className="border-b border-line py-3">
            <h3>Grupo {group}</h3>
            <ol>
              {order.map((team) => (
                <li key={team}>{team}</li>
              ))}
            </ol>
          </section>
        ))}
      {prediction?.customRounds?.map((round, index) => (
        <section key={index} className="border-b border-line py-3">
          <h3>Ronda {index + 1}</h3>
          <ol>
            {round.map((winner, position) => (
              <li key={position}>{winner}</li>
            ))}
          </ol>
        </section>
      ))}
      {prediction?.champion && <p className="font-bold">Campeón: {prediction.champion}</p>}
    </ViewerModal>
  );
}
