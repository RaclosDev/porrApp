import type { AdminOverview } from '../../types/api';
import { kindLabel, shortDay } from './adminFormat';

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <li className="admin-stat">
      <span className="admin-stat-value">{value.toLocaleString('es-ES')}</span>
      <span className="admin-stat-label">{label}</span>
      {hint ? <span className="admin-stat-hint">{hint}</span> : null}
    </li>
  );
}

function SignupsChart({ days }: { days: AdminOverview['signupsByDay'] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const best = days.reduce<(typeof days)[number] | null>(
    (top, d) => (top === null || d.count > top.count ? d : top),
    null,
  );
  const label = (day: string) => shortDay.format(new Date(`${day}T00:00:00Z`)).replace('.', '');
  return (
    <>
      <div
        className="admin-chart"
        role="img"
        aria-label={`Altas de los últimos ${days.length} días: ${total} en total${
          best && best.count > 0
            ? `; el día con más fue el ${label(best.day)}, con ${best.count}`
            : ''
        }.`}
      >
        {days.map((d, index) => (
          <div
            key={d.day}
            title={`${label(d.day)}: ${d.count}`}
            className={`admin-chart-bar ${index === days.length - 1 ? 'is-today' : ''}`}
            style={{ height: `${(d.count / max) * 100}%` }}
          />
        ))}
      </div>
      {days.length > 0 && (
        <div className="admin-chart-axis" aria-hidden="true">
          <span>{label(days[0].day)}</span>
          <span>Máximo: {max} al día</span>
          <span>Hoy</span>
        </div>
      )}
    </>
  );
}

/** Pestaña «Resumen»: cifras de cuentas y ligas y altas de los últimos 30 días. */
export default function AdminSummary({ data }: { data: AdminOverview }) {
  const { totals } = data;
  const signups30d = data.signupsByDay.reduce((sum, d) => sum + d.count, 0);
  return (
    <>
      <section className="league-admin-card" aria-labelledby="admin-people-title">
        <h2 className="admin-section-title" id="admin-people-title">
          Personas
        </h2>
        <ul className="admin-stat-grid">
          <Stat label="Usuarios" value={totals.users} />
          <Stat
            label="Altas 24 h"
            value={totals.newUsers24h}
            hint={`${totals.newUsers7d} en 7 días`}
          />
          <Stat label="Altas 30 días" value={totals.newUsers30d} />
          <Stat
            label="Activos 24 h"
            value={totals.active24h}
            hint={`${totals.active7d} en 7 días`}
          />
        </ul>
      </section>

      <section className="league-admin-card" aria-labelledby="admin-leagues-title">
        <h2 className="admin-section-title" id="admin-leagues-title">
          Ligas
        </h2>
        <ul className="admin-stat-grid">
          <Stat
            label="Ligas"
            value={totals.leagues}
            hint={`${totals.newLeagues7d} nuevas en 7 días`}
          />
          <Stat label="Ligas públicas" value={totals.publicLeagues} />
          <Stat label="Pertenencias" value={totals.memberships} />
          {Object.entries(totals.leaguesByKind).map(([kind, n]) => (
            <Stat key={kind} label={kindLabel(kind)} value={n} />
          ))}
        </ul>
      </section>

      <section className="league-admin-card" aria-labelledby="admin-signups-title">
        <div className="league-admin-card-head">
          <h2 className="admin-section-title" id="admin-signups-title">
            Altas por día
          </h2>
          <span className="admin-pill is-accent">{signups30d} en 30 días</span>
        </div>
        <SignupsChart days={data.signupsByDay} />
      </section>
    </>
  );
}
