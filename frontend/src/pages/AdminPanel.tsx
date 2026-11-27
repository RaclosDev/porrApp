import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BellRing,
  Building2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useEffect, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminIncidents, {
  ADMIN_INCIDENTS_KEY,
  isOpenIncident,
} from '../components/admin/AdminIncidents';
import AdminNotices from '../components/admin/AdminNotices';
import AdminSummary from '../components/admin/AdminSummary';
import { AdminAccounts, AdminLeagues } from '../components/admin/AdminTables';
import { timeOnly } from '../components/admin/adminFormat';
import { fetchAdminIncidents, fetchAdminOverview } from '../services/endpoints/admin';

type Section = 'resumen' | 'cuentas' | 'ligas' | 'avisos' | 'incidencias';
const SECTIONS: Section[] = ['resumen', 'cuentas', 'ligas', 'avisos', 'incidencias'];

const isSection = (value: string | null): value is Section =>
  value !== null && (SECTIONS as string[]).includes(value);

/**
 * Panel de gestión sin enlace desde la app. Quien no es administrador ve lo mismo que en una ruta
 * que no existe.
 */
export default function AdminPanel() {
  useEffect(() => {
    document.title = 'PorrApp';
  }, []);

  const [params, setParams] = useSearchParams();
  const requested = params.get('seccion');
  const section: Section = isSection(requested) ? requested : 'resumen';
  const setSection = (next: Section) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (next === 'resumen') copy.delete('seccion');
        else copy.set('seccion', next);
        return copy;
      },
      { replace: true },
    );

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: fetchAdminOverview,
    refetchInterval: 60_000,
    retry: false,
  });
  // Solo se piden cuando el panel ya ha confirmado que la cuenta es de administrador.
  const incidents = useQuery({
    queryKey: ADMIN_INCIDENTS_KEY,
    queryFn: fetchAdminIncidents,
    refetchInterval: 60_000,
    retry: false,
    enabled: Boolean(data),
  });
  const openIncidents = incidents.data?.filter(isOpenIncident).length;

  if (isPending) {
    return (
      <p className="p-6" role="status">
        Cargando…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h1 className="poster-title text-[1.8rem]">Página no encontrada</h1>
      </div>
    );
  }

  const tabs: { id: Section; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'resumen', label: 'Resumen', icon: <BarChart3 size={15} aria-hidden="true" /> },
    {
      id: 'cuentas',
      label: 'Cuentas',
      icon: <Users size={15} aria-hidden="true" />,
      count: data.recentUsers.length,
    },
    {
      id: 'ligas',
      label: 'Ligas',
      icon: <Building2 size={15} aria-hidden="true" />,
      count: data.leagues.length,
    },
    { id: 'avisos', label: 'Avisos', icon: <BellRing size={15} aria-hidden="true" /> },
    {
      id: 'incidencias',
      label: 'Incidencias',
      icon: <ShieldAlert size={15} aria-hidden="true" />,
      count: openIncidents,
    },
  ];

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = SECTIONS.indexOf(section);
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % SECTIONS.length,
      ArrowLeft: (index - 1 + SECTIONS.length) % SECTIONS.length,
      Home: 0,
      End: SECTIONS.length - 1,
    };
    const nextIndex = keys[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    setSection(SECTIONS[nextIndex]);
    document.getElementById(`admin-tab-${SECTIONS[nextIndex]}`)?.focus();
  };

  return (
    <div className="admin-page">
      <div className="admin-sheet paper-panel">
        <header className="league-admin-header">
          <div className="league-admin-heading">
            <span className="league-admin-eyebrow">
              <ShieldCheck size={12} aria-hidden="true" />
              Gestión
            </span>
            <h1 className="league-admin-title">Panel de gestión</h1>
            <p className="league-admin-subtitle">
              {data.totals.users.toLocaleString('es-ES')} usuarios ·{' '}
              {data.totals.leagues.toLocaleString('es-ES')} ligas · datos de las{' '}
              {timeOnly.format(new Date(data.generatedAt))}
            </p>
          </div>
          <button
            type="button"
            className="league-admin-btn is-ghost"
            onClick={() => {
              void refetch();
              void incidents.refetch();
            }}
            disabled={isFetching}
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={isFetching ? 'league-admin-spin' : undefined}
            />
            {isFetching ? 'Actualizando…' : 'Actualizar'}
          </button>
        </header>

        <div className="league-admin-tabs" role="tablist" aria-label="Secciones del panel">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`admin-tab-${tab.id}`}
              aria-selected={section === tab.id}
              aria-controls={`admin-panel-${tab.id}`}
              tabIndex={section === tab.id ? 0 : -1}
              className={`league-admin-tab ${section === tab.id ? 'is-active' : ''}`}
              onKeyDown={handleTabKeyDown}
              onClick={() => setSection(tab.id)}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="league-admin-tab-count">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div
          className="admin-sheet-body"
          role="tabpanel"
          id={`admin-panel-${section}`}
          aria-labelledby={`admin-tab-${section}`}
        >
          {section === 'resumen' && <AdminSummary data={data} />}
          {section === 'cuentas' && <AdminAccounts users={data.recentUsers} />}
          {section === 'ligas' && <AdminLeagues leagues={data.leagues} />}
          {section === 'avisos' && <AdminNotices leagues={data.leagues} />}
          {section === 'incidencias' && (
            <AdminIncidents incidents={incidents.data} isError={incidents.isError} />
          )}
        </div>
      </div>
    </div>
  );
}
