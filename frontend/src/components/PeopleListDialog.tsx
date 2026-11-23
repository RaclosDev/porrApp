import { useState, type ReactNode } from 'react';
import { UserAvatar } from './Avatar';
import PhotoViewer from './PhotoViewer';
import SheetDialog from './SheetDialog';

export interface PersonItem {
  userId: number;
  name: string;
  avatarUrl: string | null;
  /** Etiqueta corta junto al nombre, como «Admin». */
  badge?: string;
}

/** Lista de personas (foto y nombre) en filas, para las hojas de miembros. Al pulsar una foto se ve en grande. */
export function PeopleList({ people }: { people: PersonItem[] }) {
  const [zoomed, setZoomed] = useState<PersonItem | null>(null);
  return (
    <>
      <ul className="sheet-people">
        {people.map((person) => {
          const avatar = (
            <UserAvatar
              url={person.avatarUrl}
              userId={person.userId}
              name={person.name}
              size={36}
            />
          );
          return (
            <li key={person.userId} className="sheet-person">
              {person.avatarUrl ? (
                <button
                  type="button"
                  className="sheet-person-photo"
                  onClick={() => setZoomed(person)}
                  aria-label={`Ver la foto de ${person.name}`}
                >
                  {avatar}
                </button>
              ) : (
                avatar
              )}
              <span className="sheet-person-name">{person.name}</span>
              {person.badge && <span className="sheet-person-badge">{person.badge}</span>}
            </li>
          );
        })}
      </ul>
      {zoomed?.avatarUrl && (
        <PhotoViewer url={zoomed.avatarUrl} name={zoomed.name} onClose={() => setZoomed(null)} />
      )}
    </>
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
