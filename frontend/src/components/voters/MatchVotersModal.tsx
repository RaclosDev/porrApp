import { useState } from 'react';
import SheetDialog from '../SheetDialog';
import { PeopleList } from '../PeopleListDialog';
import type { MatchVoter, MatchVoters } from '../../types/api';

interface MatchVotersModalProps {
  voters: MatchVoters | null;
  homeTeam: string;
  awayTeam: string;
  onClose: () => void;
  /** Cruce de cuadro: no hay empate que mostrar. */
  twoWay?: boolean;
}

type Side = 'home' | 'draw' | 'away';
type Filter = 'all' | Side;

/** A partir de cuánta gente sale el buscador: con pocos se ve todo de un vistazo. */
const SEARCH_FROM = 8;

/** Sin mayúsculas ni tildes, para buscar «jose» y encontrar a «José». */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Quién ha votado cada signo de un partido cerrado, agrupado por opción, con el porcentaje de cada
 * una. Se puede quedar solo con una opción y, si hay mucha gente, buscar por nombre.
 */
export default function MatchVotersModal(props: MatchVotersModalProps) {
  if (!props.voters) return null;
  // Montado solo con el partido abierto: filtro y búsqueda empiezan de cero en cada partido.
  return <MatchVotersSheet {...props} voters={props.voters} />;
}

function MatchVotersSheet({
  voters,
  homeTeam,
  awayTeam,
  onClose,
  twoWay = false,
}: MatchVotersModalProps & { voters: MatchVoters }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const allGroups: { key: Side; sign: string; title: string; list: MatchVoter[] }[] = [
    { key: 'home', sign: twoWay ? homeTeam : '1', title: `Gana ${homeTeam}`, list: voters.home },
    { key: 'draw', sign: 'X', title: 'Empate', list: voters.draw },
    { key: 'away', sign: twoWay ? awayTeam : '2', title: `Gana ${awayTeam}`, list: voters.away },
  ];
  const groups = allGroups.filter(({ key }) => !twoWay || key !== 'draw');

  const total = groups.reduce((sum, group) => sum + group.list.length, 0);
  const percent = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  const needle = normalize(query);
  const matches = (voter: MatchVoter) => !needle || normalize(voter.name).includes(needle);
  const shown = groups
    .filter(({ key }) => filter === 'all' || filter === key)
    .map((group) => ({ ...group, visible: group.list.filter(matches) }))
    // Al buscar se ocultan las opciones sin nadie con ese nombre.
    .filter((group) => !needle || group.visible.length > 0);

  const filters: { key: Filter; label: string; name: string; count: number }[] = [
    { key: 'all', label: 'Todos', name: 'Todos', count: total },
    ...groups.map(({ key, sign, title, list }) => ({
      key,
      label: sign,
      name: title,
      count: list.length,
    })),
  ];

  return (
    <SheetDialog
      title={`${homeTeam} - ${awayTeam}`}
      subtitle={`${total} ${total === 1 ? 'predicción' : 'predicciones'}`}
      onClose={onClose}
    >
      <div className="match-voters-tools">
        {total > 0 && (
          <div className="match-voters-bar" aria-hidden="true">
            {groups.map(({ key, list }) =>
              list.length > 0 ? (
                <i key={key} className={`is-${key}`} style={{ flexGrow: list.length }} />
              ) : null,
            )}
          </div>
        )}
        <div className="match-voters-filters" role="group" aria-label="Filtrar por opción">
          {filters.map(({ key, label, name, count }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              aria-label={`${name} (${count})`}
              onClick={() => setFilter(key)}
              className={`match-voters-filter${key === 'all' ? ' is-all' : ''}${filter === key ? ' is-active' : ''}`}
            >
              <span className="min-w-0 truncate">{label}</span>
              <b>{count}</b>
            </button>
          ))}
        </div>
        {total >= SEARCH_FROM && (
          <input
            type="search"
            className="match-voters-search"
            placeholder="Buscar participante"
            aria-label="Buscar participante"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </div>

      <div className="sheet-dialog-body">
        {shown.length === 0 && <p className="sheet-dialog-status">Nadie se llama así.</p>}
        {shown.map(({ key, sign, title, list, visible }) => (
          <section key={key} className="match-voters-group" aria-label={`${sign} · ${title}`}>
            <h3 className="match-voters-heading">
              {!twoWay && <span className="match-voters-sign">{sign}</span>}
              <span className="min-w-0 truncate">{title}</span>
              <span className="match-voters-count">
                {list.length} · {percent(list.length)}%
              </span>
            </h3>
            {visible.length === 0 ? (
              <p className="sheet-dialog-status">Nadie</p>
            ) : (
              <PeopleList
                people={visible.map((voter) => ({
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
