import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarClock, TriangleAlert, X } from 'lucide-react';
import type { Group } from '../../types/api';
import { errorMessage } from '../../utils/errors';
import { queryKeys } from '../../services/queryKeys';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { LeagueAvatar } from '../Avatar';
import CustomLockCard from './custom/CustomLockCard';
import type { SaveAction } from './custom/customCompetition';

/** El cuadro se pronostica cruce a cruce: torneos con cuadro propio (no el Mundial). */
export const allowsProgressiveLock = (group: Group) =>
  group.customCompetition ||
  (group.formatType === 'TOURNAMENT' && group.competitionExternalId !== 'fifa.world');

/** Cierre de predicciones de una liga de cuadro sobre una competición oficial. */
export default function LeagueLockEditor({
  group,
  onClose,
}: {
  group: Group;
  onClose: () => void;
}) {
  const groupKey = group.id.toString();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogFocus(panelRef, { onEscape: () => !busy && onClose() });

  const save: SaveAction = async (action, success) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customLockState(groupKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.group(groupKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
      ]);
      toast.success(success);
      return true;
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudieron guardar los cambios'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-lock-title"
      className="league-admin-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="league-admin-panel paper-panel landing-tape paper-dialog"
      >
        <header className="league-admin-header">
          <LeagueAvatar url={group.imageUrl} size={46} />
          <div className="league-admin-heading">
            <span className="league-admin-eyebrow">
              <CalendarClock size={12} aria-hidden="true" />
              Cierre de predicciones
            </span>
            <h2 id="league-lock-title" className="league-admin-title">
              {group.name}
            </h2>
            {group.competitionName && (
              <p className="league-admin-subtitle">{group.competitionName}</p>
            )}
          </div>
          <button
            type="button"
            className="league-admin-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar cierre de predicciones"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="league-admin-body">
          {error && (
            <div className="league-admin-alert" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Descartar aviso">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <CustomLockCard
            group={group}
            save={save}
            allowProgressive={allowsProgressiveLock(group)}
          />
        </div>
      </div>
    </div>
  );
}
