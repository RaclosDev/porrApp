import { UserAvatar } from '../Avatar';
import type { BracketEntry, StagePickers } from '../../utils/bracketStats';

interface StagePickersListProps {
  pickers: StagePickers;
  avatarByUserId: Map<number, string>;
  onOpen: (predictionId: string) => void;
}

function PersonButton({
  entry,
  avatarByUserId,
  onOpen,
  note,
  muted = false,
}: {
  entry: BracketEntry;
  avatarByUserId: Map<number, string>;
  onOpen: (predictionId: string) => void;
  note?: string;
  muted?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry.id)}
        aria-label={`Ver el cuadro de ${entry.name}${note ? ` (${note})` : ''}`}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-[10px] border px-2.5 py-1.5 text-left transition-colors hover:bg-[rgba(17,24,39,0.06)] ${muted ? 'border-line bg-transparent' : 'border-[rgba(11,95,116,0.35)] bg-[rgba(11,95,116,0.08)]'}`}
      >
        <UserAvatar
          url={entry.userId !== null ? avatarByUserId.get(entry.userId) : null}
          userId={entry.userId}
          name={entry.name}
          size={28}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-main">{entry.name}</span>
          {note && <span className="block truncate text-[0.78rem] text-muted">{note}</span>}
        </span>
      </button>
    </li>
  );
}

/** Quién pone al equipo en la ronda y hasta dónde lo lleva el resto. Abre el cuadro de cada uno. */
export default function StagePickersList({
  pickers,
  avatarByUserId,
  onOpen,
}: StagePickersListProps) {
  const listClass =
    'm-0 grid list-none grid-cols-1 gap-1.5 p-0 min-[420px]:grid-cols-2 lg:grid-cols-3';
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="m-0 mb-2 text-[0.92rem] font-bold text-main">
          Sí lo ponen <span className="text-muted">({pickers.yes.length})</span>
        </h4>
        {pickers.yes.length === 0 ? (
          <p className="m-0 text-[0.9rem] text-muted">Nadie.</p>
        ) : (
          <ul className={listClass}>
            {pickers.yes.map((entry) => (
              <PersonButton
                key={entry.id}
                entry={entry}
                avatarByUserId={avatarByUserId}
                onOpen={onOpen}
              />
            ))}
          </ul>
        )}
      </div>
      {pickers.no.length > 0 && (
        <div>
          <h4 className="m-0 mb-2 text-[0.92rem] font-bold text-main">
            No lo ponen <span className="text-muted">({pickers.no.length})</span>
          </h4>
          <ul className={listClass}>
            {pickers.no.map(({ entry, note }) => (
              <PersonButton
                key={entry.id}
                entry={entry}
                avatarByUserId={avatarByUserId}
                onOpen={onOpen}
                note={note}
                muted
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
