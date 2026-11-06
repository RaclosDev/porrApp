import SheetDialog from '../SheetDialog';
import { PeopleList } from '../PeopleListDialog';
import type { MatchVoters } from '../../types/api';

interface MatchVotersModalProps {
  voters: MatchVoters | null;
  homeTeam: string;
  awayTeam: string;
  onClose: () => void;
  /** Cruce de cuadro: no hay empate que mostrar. */
  twoWay?: boolean;
}

/** Quién ha votado cada signo de un partido cerrado, agrupado por opción. */
export default function MatchVotersModal({
  voters,
  homeTeam,
  awayTeam,
  onClose,
  twoWay = false,
}: MatchVotersModalProps) {
  if (!voters) return null;

  const groups = [
    { key: 'home', sign: '1', title: `Gana ${homeTeam}`, list: voters.home },
    { key: 'draw', sign: 'X', title: 'Empate', list: voters.draw },
    { key: 'away', sign: '2', title: `Gana ${awayTeam}`, list: voters.away },
  ].filter(({ key }) => !twoWay || key !== 'draw');

  return (
    <SheetDialog title={`${homeTeam} - ${awayTeam}`} onClose={onClose}>
      <div className="sheet-dialog-body">
        {groups.map(({ key, sign, title, list }) => (
          <section key={key} className="match-voters-group" aria-label={`${sign} · ${title}`}>
            <h3 className="match-voters-heading">
              <span className="match-voters-sign">{sign}</span>
              <span className="min-w-0 truncate">{title}</span>
              <span className="match-voters-count">{list.length}</span>
            </h3>
            {list.length === 0 ? (
              <p className="sheet-dialog-status">Nadie</p>
            ) : (
              <PeopleList
                people={list.map((voter) => ({
                  userId: voter.userId,
                  name: voter.name,
                  avatarUrl: voter.avatarUrl,
                }))}
              />
            )}
          </section>
        ))}
      </div>
    </SheetDialog>
  );
}
