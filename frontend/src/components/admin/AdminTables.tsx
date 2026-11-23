import { ArrowDown, ArrowUp, Search } from 'lucide-react';
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

type AdminUser = AdminOverview['recentUsers'][number];
type AccountSort = 'name' | 'email' | 'method' | 'joinedAt' | 'lastActiveAt' | 'leagues';

/** Columnas de «Cuentas»; las fechas y los recuentos empiezan por lo más reciente o lo mayor. */
const ACCOUNT_COLUMNS: {
  key: AccountSort;
  label: string;
  numeric?: boolean;
  descFirst?: boolean;
  value: (user: AdminUser) => string | number;
}[] = [
  { key: 'name', label: 'Nombre', value: (u) => normalize(u.name) },
  { key: 'email', label: 'Email', value: (u) => normalize(u.email) },
  { key: 'method', label: 'Acceso', value: (u) => METHOD_LABELS[u.method] ?? u.method },
  { key: 'joinedAt', label: 'Alta', descFirst: true, value: (u) => Date.parse(u.joinedAt) },
  {
    key: 'lastActiveAt',
    label: 'Última vez',
    descFirst: true,
    value: (u) => Date.parse(u.lastActiveAt),
  },
  { key: 'leagues', label: 'Ligas', numeric: true, descFirst: true, value: (u) => u.leagues },
];

/** Pestaña «Cuentas»: las últimas cuentas creadas, ordenables por cualquier columna. */
export function AdminAccounts({ users }: { users: AdminOverview['recentUsers'] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: AccountSort; desc: boolean }>({
    key: 'joinedAt',
    desc: true,
  });
  const sortBy = (key: AccountSort) =>
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: Boolean(ACCOUNT_COLUMNS.find((c) => c.key === key)?.descFirst) },
    );
  const visible = useMemo(() => {
    const query = normalize(search.trim());
    const found = query
      ? users.filter((u) => normalize(`${u.name} ${u.email}`).includes(query))
      : users;
    const column = ACCOUNT_COLUMNS.find((c) => c.key === sort.key);
    if (!column) return found;
    const direction = sort.desc ? -1 : 1;
    return [...found].sort((a, b) => {
      const x = column.value(a);
      const y = column.value(b);
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), 'es');
      return order * direction;
    });
  }, [users, search, sort]);

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
        {/* En el móvil no hay cabeceras que pulsar: el orden se elige aquí. */}
        <div className="admin-sort-select">
          <label htmlFor="admin-accounts-sort">Ordenar por</label>
          <select
            id="admin-accounts-sort"
            className="glass-input"
            value={sort.key}
            onChange={(event) => sortBy(event.target.value as AccountSort)}
          >
            {ACCOUNT_COLUMNS.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-sort-direction"
            onClick={() => sortBy(sort.key)}
            aria-label={sort.desc ? 'Orden descendente: cambiar' : 'Orden ascendente: cambiar'}
          >
            {sort.desc ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
          </button>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <caption className="sr-only">
            Últimas cuentas creadas; pulsa una cabecera para ordenar por esa columna
          </caption>
          <thead>
            <tr>
              {ACCOUNT_COLUMNS.map((column) => {
                const active = sort.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.numeric ? 'is-num' : undefined}
                    aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                  >
                    <button
                      type="button"
                      className={`admin-sort-btn${active ? ' is-active' : ''}`}
                      onClick={() => sortBy(column.key)}
                    >
                      {column.label}
                      {active && sort.desc ? (
                        <ArrowDown size={12} aria-hidden="true" />
                      ) : (
                        <ArrowUp size={12} aria-hidden="true" />
                      )}
                    </button>
                  </th>
                );
              })}
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
