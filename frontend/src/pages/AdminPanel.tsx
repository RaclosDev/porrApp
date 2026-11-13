import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchAdminOverview } from '../services/endpoints/admin';
import type { AdminOverview } from '../types/api';

const dateTime = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

const KIND_LABELS: Record<string, string> = {
  POOL: 'Porras',
  SCOREBOARD: 'Marcadores',
  TOURNAMENT: 'Torneos',
  POKER: 'Póker',
};

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="paper-panel px-4 py-3">
      <div className="text-[1.6rem] font-bold leading-none">{value}</div>
      <div className="text-[0.85rem] mt-1">{label}</div>
      {hint ? <div className="text-muted text-[0.75rem]">{hint}</div> : null}
    </div>
  );
}

function SignupsChart({ days }: { days: AdminOverview['signupsByDay'] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div
      className="flex items-end gap-[3px] h-24"
      role="img"
      aria-label="Altas de los últimos 30 días"
    >
      {days.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.count}`}
          className="flex-1 bg-current opacity-70 min-h-[2px]"
          style={{ height: `${(d.count / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Panel de gestión sin enlace desde la app. Quien no es administrador ve lo mismo que en una ruta
 * que no existe.
 */
export default function AdminPanel() {
  useEffect(() => {
    document.title = 'PorrApp';
  }, []);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: fetchAdminOverview,
    refetchInterval: 60_000,
    retry: false,
  });

  if (isPending) return <p className="p-6">Cargando…</p>;
  if (isError || !data) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h1 className="poster-title text-[1.8rem]">Página no encontrada</h1>
      </div>
    );
  }

  const { totals } = data;
  return (
    <div className="max-w-6xl mx-auto px-3 py-6 text-left space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="poster-title text-[1.6rem]">Panel</h1>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="underline min-h-11"
        >
          {isFetching
            ? 'Actualizando…'
            : `Actualizar (${dateTime.format(new Date(data.generatedAt))})`}
        </button>
      </header>

      <section aria-label="Cifras" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Usuarios" value={totals.users} />
        <Stat
          label="Altas 24 h"
          value={totals.newUsers24h}
          hint={`${totals.newUsers7d} en 7 días`}
        />
        <Stat label="Altas 30 días" value={totals.newUsers30d} />
        <Stat label="Activos 24 h" value={totals.active24h} hint={`${totals.active7d} en 7 días`} />
        <Stat
          label="Ligas"
          value={totals.leagues}
          hint={`${totals.newLeagues7d} nuevas en 7 días`}
        />
        <Stat label="Ligas públicas" value={totals.publicLeagues} />
        <Stat label="Pertenencias" value={totals.memberships} />
        {Object.entries(totals.leaguesByKind).map(([kind, n]) => (
          <Stat key={kind} label={KIND_LABELS[kind] ?? kind} value={n} />
        ))}
      </section>

      <section className="paper-panel p-4">
        <h2 className="font-bold mb-2">Altas por día (30 días)</h2>
        <SignupsChart days={data.signupsByDay} />
      </section>

      <section className="paper-panel p-4 overflow-x-auto">
        <h2 className="font-bold mb-2">Últimas cuentas</h2>
        <table className="w-full text-[0.85rem]">
          <thead>
            <tr className="text-left">
              <th className="pr-3">Nombre</th>
              <th className="pr-3">Email</th>
              <th className="pr-3">Acceso</th>
              <th className="pr-3">Alta</th>
              <th className="pr-3">Última vez</th>
              <th>Ligas</th>
            </tr>
          </thead>
          <tbody>
            {data.recentUsers.map((u) => (
              <tr key={u.id}>
                <td className="pr-3">{u.name}</td>
                <td className="pr-3">{u.email}</td>
                <td className="pr-3">{u.method}</td>
                <td className="pr-3">{dateTime.format(new Date(u.joinedAt))}</td>
                <td className="pr-3">{dateTime.format(new Date(u.lastActiveAt))}</td>
                <td>{u.leagues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="paper-panel p-4 overflow-x-auto">
        <h2 className="font-bold mb-2">Ligas (más recientes primero)</h2>
        <table className="w-full text-[0.85rem]">
          <thead>
            <tr className="text-left">
              <th className="pr-3">Nombre</th>
              <th className="pr-3">Clase</th>
              <th className="pr-3">Pública</th>
              <th className="pr-3">Creada por</th>
              <th className="pr-3">Miembros</th>
              <th>Creada</th>
            </tr>
          </thead>
          <tbody>
            {data.leagues.map((l) => (
              <tr key={l.id}>
                <td className="pr-3">{l.name}</td>
                <td className="pr-3">{KIND_LABELS[l.kind] ?? l.kind}</td>
                <td className="pr-3">{l.isPublic ? 'Sí' : 'No'}</td>
                <td className="pr-3">{l.owner ?? '—'}</td>
                <td className="pr-3">{l.members}</td>
                <td>{dateTime.format(new Date(l.createdAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
