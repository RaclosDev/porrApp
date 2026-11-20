import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AdminOverview } from '../../types/api';
import { KIND_LABELS, METHOD_LABELS, dateTime, kindLabel, normalize } from './adminFormat';

function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="league-admin-search">
      <Search size={15} aria-hidden="true" />
      <input
        type="search"
        className="glass-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${label}…`}
        aria-label={label}
      />
    </div>
  );
}

function ListCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return (
    <p className="admin-list-count" aria-live="polite">
      {shown === total ? `${total} ${noun}` : `${shown} de ${total} ${noun}`}
    </p>
  );
}

/** Pestaña «Cuentas»: las últimas cuentas creadas. */
export function AdminAccounts({ users }: { users: AdminOverview['recentUsers'] }) {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return users;
    return users.filter((u) => normalize(`${u.name} ${u.email}`).includes(query));
  }, [users, search]);

  return (
    <section className="league-admin-card" aria-labelledby="admin-accounts-title">
      <div className="league-admin-card-head">
        <h2 className="admin-section-title" id="admin-accounts-title">
          Últimas cuentas
        </h2>
        <ListCount shown={visible.length} total={users.length} noun="cuentas" />
      </div>
      <div className="league-admin-toolbar">
        <SearchBox value={search} onChange={setSearch} label="Buscar por nombre o email" />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <caption className="sr-only">
            Últimas cuentas creadas, de la más reciente a la más antigua
          </caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Email</th>
              <th scope="col">Acceso</th>
              <th scope="col">Alta</th>
              <th scope="col">Última vez</th>
              <th scope="col" className="is-num">
                Ligas
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id}>
                <td className="is-head is-strong">{u.name}</td>
                <td className="is-wide is-muted" data-label="Email">
                  {u.email}
                </td>
                <td data-label="Acceso">
                  <span className="admin-pill">{METHOD_LABELS[u.method] ?? u.method}</span>
                </td>
                <td data-label="Alta">{dateTime.format(new Date(u.joinedAt))}</td>
                <td data-label="Última vez">{dateTime.format(new Date(u.lastActiveAt))}</td>
                <td className="is-num" data-label="Ligas">
                  {u.leagues}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="admin-table-empty">Ninguna cuenta coincide.</p>}
      </div>
    </section>
  );
}

/** Pestaña «Ligas»: ligas más recientes, con filtro por clase. */
export function AdminLeagues({ leagues }: { leagues: AdminOverview['leagues'] }) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<string>('ALL');
  const kinds = useMemo(() => {
    const present = new Set(leagues.map((l) => l.kind));
    return [
      ...Object.keys(KIND_LABELS).filter((k) => present.has(k)),
      ...[...present].filter((k) => !(k in KIND_LABELS)),
    ];
  }, [leagues]);
  const visible = useMemo(() => {
    const query = normalize(search.trim());
    return leagues.filter(
      (l) =>
        (kind === 'ALL' || l.kind === kind) &&
        (!query || normalize(`${l.name} ${l.owner ?? ''}`).includes(query)),
    );
  }, [leagues, search, kind]);

  return (
    <section className="league-admin-card" aria-labelledby="admin-leagues-list-title">
      <div className="league-admin-card-head">
        <h2 className="admin-section-title" id="admin-leagues-list-title">
          Ligas más recientes
        </h2>
        <ListCount shown={visible.length} total={leagues.length} noun="ligas" />
      </div>
      <div className="league-admin-toolbar">
        <SearchBox value={search} onChange={setSearch} label="Buscar liga o creador" />
        {kinds.length > 1 && (
          <div className="league-admin-filter" role="group" aria-label="Filtrar por clase">
            {['ALL', ...kinds].map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                className={kind === k ? 'is-active' : ''}
                onClick={() => setKind(k)}
              >
                {k === 'ALL' ? 'Todas' : kindLabel(k)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <caption className="sr-only">Ligas, de la más reciente a la más antigua</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Clase</th>
              <th scope="col">Pública</th>
              <th scope="col">Creada por</th>
              <th scope="col" className="is-num">
                Miembros
              </th>
              <th scope="col">Creada</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={l.id}>
                <td className="is-head is-strong">{l.name}</td>
                <td data-label="Clase">
                  <span className="admin-pill">{kindLabel(l.kind)}</span>
                </td>
                <td data-label="Pública">
                  {l.isPublic ? <span className="admin-pill is-accent">Sí</span> : 'No'}
                </td>
                <td className="is-muted" data-label="Creada por">
                  {l.owner ?? '—'}
                </td>
                <td className="is-num" data-label="Miembros">
                  {l.members}
                </td>
                <td data-label="Creada">{dateTime.format(new Date(l.createdAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="admin-table-empty">Ninguna liga coincide.</p>}
      </div>
    </section>
  );
}
