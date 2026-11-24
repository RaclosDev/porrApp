import React, { Suspense } from 'react';
import { lazyPage } from './services/chunkReload';
import {
  createBrowserRouter,
  Navigate,
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { PlayerCards } from './components/PlayerCard';
import { useAppStore } from './store/useAppStore';
import { useLeaguePredictions } from './hooks/useLeaguePredictions';
import { leaderPredictionId } from './utils/demoPrediction';
import Layout from './components/Layout';
import PwaUpdater from './components/PwaUpdater';
import PushNavigation from './components/PushNavigation';
import ScrollOnNavigate from './components/ScrollOnNavigate';
import CookieConsent from './components/layout/CookieConsent';
import RouteHead from './components/layout/RouteHead';
import { RequireLeague } from './components/NoLeagueState';
import LeagueLoadState from './components/LeagueLoadState';
import ScoreboardOnly from './components/tracker/ScoreboardOnly';
import { pokerRoutes, type PokerSection } from './components/poker/pokerRoutes';
import { CONTENT_PAGES } from './seo/pages';
import { PageSkeleton } from './components/Skeleton';
import ConfirmDialog from './components/ConfirmDialog';
import LeaveGuard from './components/LeaveGuard';
import { Toaster } from 'react-hot-toast';
import { useSessionHandoffPending } from './hooks/useSessionHandoffPending';
import { useRequestedGroup } from './hooks/useRequestedGroup';
import { hideSplash, isSplashVisible } from './services/splash';
import { DEMO, EMBED } from './demo/mode';

const Leaderboard = lazyPage(() => import('./pages/Leaderboard'));
const Home = lazyPage(() => import('./pages/Home'));
const PredictionViewer = lazyPage(() => import('./components/PredictionViewer'));
const Landing = lazyPage(() => import('./pages/Landing'));
const Radar = lazyPage(() => import('./pages/Radar'));
const Bracket = lazyPage(() => import('./pages/Bracket'));
const Stats = lazyPage(() => import('./pages/Stats'));
const Search = lazyPage(() => import('./pages/Search'));
const GroupsDashboard = lazyPage(() => import('./pages/GroupsDashboard'));
const CreateLeague = lazyPage(() => import('./pages/CreateLeague'));
const CreatePokerLeague = lazyPage(() => import('./pages/CreatePokerLeague'));
const PokerLeague = lazyPage(() => import('./pages/PokerLeague'));
const CreateTracker = lazyPage(() => import('./pages/CreateTracker'));
const CreateTournament = lazyPage(() => import('./pages/CreateTournament'));
const OrganizedTournament = lazyPage(() => import('./pages/OrganizedTournament'));
const TrackerView = lazyPage(() => import('./pages/TrackerView'));
const TrackerHistoryPage = lazyPage(() => import('./pages/TrackerHistoryPage'));
const JoinRedirect = lazyPage(() => import('./components/JoinRedirect'));
const OfficialBracket = lazyPage(() => import('./pages/OfficialBracket'));
const LinkedInEntry = lazyPage(() => import('./pages/LinkedInEntry'));
const MatchdayPredictor = lazyPage(() => import('./pages/MatchdayPredictor'));
const LeagueStandings = lazyPage(() => import('./pages/LeagueStandings'));
const Legal = lazyPage(() => import('./pages/Legal'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
const AdminPanel = lazyPage(() => import('./pages/AdminPanel'));
const Login = lazyPage(() => import('./pages/Login'));
const ContentPage = lazyPage(() => import('./pages/ContentPage'));

function PokerLeagueRoute({ view }: { view: PokerSection }) {
  const context = useAppContext();
  const switchingGroup = useRequestedGroup(context);
  const { leagueKind, groupError, activeGroupId } = context;
  if (switchingGroup) return <PageSkeleton />;
  if (leagueKind === 'loading') return <LeagueLoadState />;
  if (leagueKind === 'error') return <LeagueLoadState error={groupError} />;
  if (leagueKind !== 'poker' || !activeGroupId) return <Navigate to="/" replace />;
  return <PokerLeague key={`${activeGroupId}:${view}`} leagueId={activeGroupId} view={view} />;
}

// Rutas que un visitante invitado (guest_mode) puede ver sin loguearse
const GUEST_ALLOWED_PATHS = [
  '/',
  '/demo',
  '/bracket',
  '/grupos',
  '/ranking',
  '/clasificacion',
  '/search',
  '/stats',
  '/radar',
  '/mis-ligas',
  '/tabla',
];

/**
 * Va dentro del Suspense de las rutas: solo se monta cuando la primera página ya ha cargado y se
 * pinta, y entonces retira la pantalla de arranque.
 */
const SplashDone = () => {
  React.useEffect(() => hideSplash(), []);
  return null;
};

/** Con la pantalla de arranque delante, el esqueleto genérico solo asomaría un instante. */
const RouteFallback = () => (isSplashVisible() ? null : <PageSkeleton />);

const RootPage = () => {
  const { isAuthenticated, userName } = useAppContext();
  const isAuthed = isAuthenticated && Boolean(userName);
  const handoffPending = useSessionHandoffPending();

  if (isAuthed) return <LeagueHome />;

  return handoffPending ? <PageSkeleton /> : <Landing />;
};

/** Inicio de la liga activa; los avisos llegan con ?group= de su liga (p. ej. «Nuevo miembro»). */
const LeagueHome = () => {
  const switchingGroup = useRequestedGroup(useAppContext());
  if (switchingGroup) return <PageSkeleton />;
  return (
    <RequireLeague title="Inicio" what="los partidos y el ranking">
      <Home />
    </RequireLeague>
  );
};

const DemoPredictionPage = () => {
  const { leaderboardData, loadingLeaderboard } = useAppContext();
  const participantsHashes = useLeaguePredictions();

  // La demo muestra en solo lectura la porra del primero de la liga pública; sin clasificación,
  // la primera que haya.
  const predictionId = leaderPredictionId(leaderboardData) ?? participantsHashes[0]?.key;

  // Mientras llega la clasificación no se enseña otra porra que luego cambie por la del líder.
  if (loadingLeaderboard) return <PageSkeleton />;

  if (!predictionId) {
    return (
      <section className="view-section block paper-panel album-sheet p-6">
        <h2>Mi Porra · Demo</h2>
        <p role="status">Todavía no hay porras en esta liga.</p>
      </section>
    );
  }

  return <PredictionViewer inline predictionId={predictionId} />;
};

/** /demo: dentro de la demo lleva al inicio; desde la aplicación real, la arranca recargando. */
const DemoPage = () => {
  React.useEffect(() => {
    if (!DEMO) window.location.replace('/demo' + window.location.search);
  }, []);

  return DEMO ? <Navigate to="/" replace /> : <PageSkeleton />;
};

const ProtectedRoute = ({
  children,
  guestAllowed = false,
}: {
  children: React.ReactNode;
  guestAllowed?: boolean;
}) => {
  const { isAuthenticated, userName, isDemoMode } = useAppContext();
  const isAuthed = isAuthenticated && Boolean(userName);
  const profileChecked = useAppStore((state) => state.profileChecked);
  const location = useLocation();

  // En demo, Mi Porra abre una porra real de la liga en modo de solo lectura.
  if (isDemoMode && location.pathname === '/prediction') {
    return <DemoPredictionPage />;
  }

  // Rutas públicas de lectura accesibles para cualquier visitante sin login
  if (guestAllowed || GUEST_ALLOWED_PATHS.includes(location.pathname)) {
    return children;
  }

  // Con sesión pero sin el nombre guardado en este dispositivo, se espera al perfil del servidor
  // antes de pedir que se inicie sesión.
  if (isAuthenticated && !userName && !profileChecked) return <PageSkeleton />;

  if (!isAuthed) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return children;
};

/** Lo que va dentro del enrutador: avisos globales, la maqueta y las rutas. */
/** Los QR antiguos de los marcadores llevan a la invitación de la liga. */
function LegacyScoreboardJoin() {
  const { code = '' } = useParams();
  return <Navigate to={`/join/${encodeURIComponent(code)}`} replace />;
}

function AppShell() {
  return (
    <>
      {/* La demo del visor de la portada no instala service worker, ni avisa, ni pregunta por cookies. */}
      {!EMBED && <PwaUpdater />}
      {!EMBED && <PushNavigation />}
      <ScrollOnNavigate />
      <RouteHead />
      {!EMBED && <CookieConsent />}
      <ConfirmDialog />
      <LeaveGuard />
      <PlayerCards>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
            <SplashDone />
            <Routes>
              <Route path="/" element={<RootPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Login intent="signup" />} />
              <Route path="/join/:code" element={<JoinRedirect />} />
              <Route path="/t/:publicId" element={<OrganizedTournament publicView />} />
              <Route
                path="/torneos/nuevo"
                element={
                  <ProtectedRoute>
                    <CreateTournament />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/torneos/:id"
                element={
                  <ProtectedRoute>
                    <OrganizedTournament />
                  </ProtectedRoute>
                }
              />
              <Route path="/linkedin" element={<LinkedInEntry />} />
              <Route path="/privacidad" element={<Legal kind="privacy" />} />
              <Route path="/aviso-legal" element={<Legal kind="legal" />} />
              <Route path="/restablecer-contrasena" element={<ResetPassword />} />
              <Route
                path="/gestion-7k2q"
                element={
                  <ProtectedRoute>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              {CONTENT_PAGES.map((page) => (
                <Route key={page.path} path={page.path} element={<ContentPage page={page} />} />
              ))}

              {/* Rutas de lectura - accesibles en guest_mode */}
              <Route
                path="/radar"
                element={
                  <ProtectedRoute guestAllowed>
                    <RequireLeague title="Partidos" what="los partidos">
                      <Radar />
                    </RequireLeague>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ranking"
                element={
                  <ProtectedRoute guestAllowed>
                    <Leaderboard />
                  </ProtectedRoute>
                }
              />
              {/* Alias antiguo: conserva enlaces y marcadores existentes. */}
              <Route path="/clasificacion" element={<Navigate to="/ranking" replace />} />
              <Route
                path="/grupos"
                element={
                  <RequireLeague title="Grupos" what="los grupos">
                    <Home defaultMode="groups" />
                  </RequireLeague>
                }
              />
              <Route
                path="/stats"
                element={
                  <ProtectedRoute guestAllowed>
                    <RequireLeague title="Estadísticas" what="las estadísticas">
                      <Stats />
                    </RequireLeague>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute guestAllowed>
                    <RequireLeague title="Buscar" what="las predicciones">
                      <Search />
                    </RequireLeague>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mis-ligas"
                element={
                  <ProtectedRoute guestAllowed>
                    <GroupsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crear-liga"
                element={
                  <ProtectedRoute>
                    <CreateLeague />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marcador/nuevo"
                element={
                  <ProtectedRoute>
                    <CreateTracker />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/poker/nueva"
                element={
                  <ProtectedRoute>
                    <CreatePokerLeague />
                  </ProtectedRoute>
                }
              />
              {(Object.keys(pokerRoutes) as PokerSection[]).map((view) => {
                const { to, label } = pokerRoutes[view];
                return (
                  <Route
                    key={to}
                    path={to}
                    element={
                      <ProtectedRoute>
                        <RequireLeague title={label} what="la liga de póker">
                          <PokerLeagueRoute view={view} />
                        </RequireLeague>
                      </ProtectedRoute>
                    }
                  />
                );
              })}
              {/* Liga de juegos de mesa: la hoja de la partida y el histórico por días. */}
              <Route
                path="/partida"
                element={
                  <ProtectedRoute>
                    <RequireLeague title="Partida" what="la partida">
                      <ScoreboardOnly>
                        {(leagueId) => <TrackerView leagueId={leagueId} />}
                      </ScoreboardOnly>
                    </RequireLeague>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/historico"
                element={
                  <ProtectedRoute>
                    <RequireLeague title="Histórico" what="el histórico">
                      <ScoreboardOnly>
                        {(leagueId) => <TrackerHistoryPage leagueId={leagueId} />}
                      </ScoreboardOnly>
                    </RequireLeague>
                  </ProtectedRoute>
                }
              />
              {/* Enlaces y QR antiguos de los marcadores: la invitación es la de cualquier liga. */}
              <Route path="/marcador/unirse/:code" element={<LegacyScoreboardJoin />} />
              {/* Los ids de los marcadores antiguos ya no son los de sus ligas: se elige en Mis ligas. */}
              <Route path="/marcador/:id" element={<Navigate to="/mis-ligas" replace />} />
              <Route
                path="/bracket"
                element={
                  <RequireLeague title="Resultados" what="los resultados">
                    <OfficialBracket />
                  </RequireLeague>
                }
              />
              <Route
                path="/tabla"
                element={
                  <ProtectedRoute guestAllowed>
                    <RequireLeague title="Tabla" what="la tabla">
                      <LeagueStandings />
                    </RequireLeague>
                  </ProtectedRoute>
                }
              />

              {/* Rutas privadas - siempre requieren login real */}
              <Route
                path="/prediction"
                element={
                  <ProtectedRoute>
                    <RequireLeague title="Mi porra" what="las predicciones">
                      <Bracket />
                    </RequireLeague>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/jornadas"
                element={
                  <ProtectedRoute>
                    <RequireLeague title="Mi porra" what="las predicciones">
                      <MatchdayPredictor />
                    </RequireLeague>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </PlayerCards>
    </>
  );
}

// Enrutador de datos con una sola ruta comodín: las rutas siguen declaradas en `AppShell`, pero
// así `LeaveGuard` puede retener la navegación (`useBlocker`).
const router = createBrowserRouter([{ path: '*', element: <AppShell /> }]);

function App() {
  return (
    <AppProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'paper-panel paper-toast',
          iconTheme: { primary: 'var(--text-main)', secondary: 'var(--surface-raised)' },
          success: { iconTheme: { primary: 'var(--hit)', secondary: 'var(--surface-raised)' } },
          error: { iconTheme: { primary: 'var(--miss)', secondary: 'var(--surface-raised)' } },
          style: {
            background: 'var(--surface-raised)',
            color: 'var(--text-main)',
            border: '1.5px solid rgb(var(--ink-rgb) / 0.45)',
            borderRadius: '4px',
            fontSize: '0.95rem',
            fontFamily: "'Inter', sans-serif",
            padding: '14px 18px',
            maxWidth: 'min(380px, calc(100vw - 32px))',
            boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.2)',
          },
        }}
      />
      <RouterProvider router={router} />
    </AppProvider>
  );
}

export default App;
