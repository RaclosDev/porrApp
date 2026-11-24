import type { ReactNode } from 'react';
import SheetDialog from './SheetDialog';
import { PlayerAvatar, PlayerName } from './PlayerCard';

export interface PersonItem {
  userId: number;
  name: string;
  avatarUrl: string | null;
  /** Etiqueta corta junto al nombre, como «Admin». */
  badge?: string;
}

/** Lista de personas (foto y nombre) en filas, para las hojas de miembros. Al pulsar la foto o el nombre se abre su cromo. */
export function PeopleList({ people }: { people: PersonItem[] }) {
  return (
    <ul className="sheet-people">
      {people.map((person) => (
        <li key={person.userId} className="sheet-person">
          <PlayerAvatar
            url={person.avatarUrl}
            userId={person.userId}
            name={person.name}
            size={36}
          />
          <PlayerName
            className="sheet-person-name"
            name={person.name}
            userId={person.userId}
            avatarUrl={person.avatarUrl}
          />
          {person.badge && <span className="sheet-person-badge">{person.badge}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Hoja con una lista de personas (foto y nombre), con una línea de contexto opcional encima. */
export default function PeopleListDialog({
  title,
  subtitle,
  intro,
  people,
  status,
  onClose,
}: {
  title: string;
  subtitle?: string;
  /** Texto bajo la cabecera, antes de la lista. */
  intro?: ReactNode;
  people: PersonItem[];
  /** Mensaje en lugar de la lista mientras carga o si falla. */
  status?: string;
  onClose: () => void;
}) {
  return (
    <SheetDialog title={title} subtitle={subtitle} onClose={onClose}>
      <div className="sheet-dialog-body">
        {intro && <p className="sheet-dialog-intro">{intro}</p>}
        {status ? (
          <p className="sheet-dialog-status" role="status">
            {status}
          </p>
        ) : (
          <PeopleList people={people} />
        )}
      </div>
    </SheetDialog>
  );
}
