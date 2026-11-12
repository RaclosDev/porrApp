import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { TriangleAlert, X } from 'lucide-react';
import type { Group } from '../../types/api';
import { errorMessage } from '../../utils/errors';
import { queryKeys } from '../../services/queryKeys';
import CustomLockCard from './custom/CustomLockCard';
import { leagueKindOf, type LeagueKind } from '../../context/leagueKind';
import type { SaveAction } from './custom/customCompetition';

/** Los cuadros propios (personalizados o de un torneo oficial) se pueden cerrar cruce a cruce. */
const PROGRESSIVE_LOCK: Record<LeagueKind, boolean> = {
  customBracket: true,
  ownBracket: true,
  groupStage: false,
  knockoutDraw: false,
  matchday: false,
  fightCard: false,
  tennisDraw: false,
  grandPrix: false,
  loading: false,
  error: false,
  none: false,
  unknown: false,
  scoreboard: false,
  tournament: false,
  poker: false,
};
const allowsProgressiveLock = (group: Group) =>
  PROGRESSIVE_LOCK[leagueKindOf({ hasLeague: true, loading: false, error: false, league: group })];

/**
 * Las ligas sobre una competición oficial eligen su cierre en los ajustes de la liga (las de jornadas,
 * por partidos, días o jornadas). Las personalizadas lo hacen al gestionar su competición.
 */
export const hasLeagueLockSetting = (group: Group) =>
  !group.customCompetition && Boolean(group.poolFormat) && group.poolFormat !== 'GRAND_PRIX';

/** Cierre de predicciones dentro de la administración de la liga. */
export default function LeagueLockSection({ group }: { group: Group }) {
  const groupKey = group.id.toString();
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const save: SaveAction = async (action, success) => {
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
    }
  };

  return (
    <>
      {error && (
        <div className="league-admin-alert" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Descartar aviso">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <CustomLockCard group={group} save={save} allowProgressive={allowsProgressiveLock(group)} />
    </>
  );
}
