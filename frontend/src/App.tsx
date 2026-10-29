import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import PwaUpdater from './components/PwaUpdater';
import { PageSkeleton } from './components/Skeleton';
import { Toaster } from 'react-hot-toast';

const Leaderboard = React.lazy(() => import('./pages/Leaderboard'));
const Home = React.lazy(() => import('./pages/Home'));
const PredictionViewer = React.lazy(() => import('./components/PredictionViewer'));
const Landing = React.lazy(() => import('./pages/Landing'));
const Radar = React.lazy(() => import('./pages/Radar'));
const Bracket = React.lazy(() => import('./pages/Bracket'));
const Stats = React.lazy(() => import('./pages/Stats'));
const Search = React.lazy(() => import('./pages/Search'));
const GroupsDashboard = React.lazy(() => import('./pages/GroupsDashboard'));
const JoinRedirect = React.lazy(() => import('./components/JoinRedirect'));
const OfficialBracket = React.lazy(() => import('./pages/OfficialBracket'));
const LinkedInEntry = React.lazy(() => import('./pages/LinkedInEntry'));
const MatchdayPredictor = React.lazy(() => import('./pages/MatchdayPredictor'));
const LeagueStandings = React.lazy(() => import('./pages/LeagueStandings'));

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

const RootPage = () => {
  const { isAuthenticated, userName } = useAppContext();
  const isAuthed = isAuthenticated && Boolean(userName);

  if (isAuthed) {
    return <Home />;
  }

  return <Landing />;
};

const DemoPredictionPage = () => {
  const { participantsHashes = [] } = useAppContext();

  // La demo muestra la porra pública de Raclos en modo estrictamente de solo lectura.
  const raclosPrediction = participantsHashes.find((participant) =>
    /raclos/i.test(
      String(
        participant?.participantName ||
          participant?.name ||
          participant?.data?.participantName ||
          '',
      ),
    ),
  );
  const predictionId = raclosPrediction?.key ?? raclosPrediction?.id;

  if (!predictionId) {
    return (
      <section className="view-section" style={{ display: 'block', padding: '24px' }}>
        <h2>Mi Porra · Demo</h2>
        <p role="status">No se ha encontrado la porra pública de Raclos en esta liga.</p>
      </section>
    );
  }

  return <PredictionViewer inline predictionId={predictionId} />;
};

const DemoPage = () => {
  const { enterDemoMode } = useAppContext();

  React.useEffect(() => {
    enterDemoMode?.();
  }, [enterDemoMode]);

  // Reuse the same dashboard as a real session without impersonating raclos.
  return <Home />;
};

const ProtectedRoute = ({ children, guestAllowed = false }) => {
  const { isAuthenticated, userName, isDemoMode } = useAppContext();
  const isAuthed = isAuthenticated && Boolean(userName);
  const location = useLocation();

  // En demo, Mi Porra abre la porra real de Raclos en modo de solo lectura.
  if (isDemoMode && location.pathname === '/prediction') {
    return <DemoPredictionPage />;
  }

  // Rutas públicas de lectura accesibles para cualquier visitante sin login
  if (guestAllowed || GUEST_ALLOWED_PATHS.includes(location.pathname)) {
    return children;
  }

  if (!isAuthed) {
    return <Navigate to="/" state={{ requireLogin: true, from: location.pathname }} replace />;
  }
  return children;
};

function App() {
  return (
    <AppProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '12px',
            fontSize: '0.95rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          },
        }}
      />
      <Router>
        <PwaUpdater />
        <Layout>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<RootPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/join/:code" element={<JoinRedirect />} />
              <Route path="/linkedin" element={<LinkedInEntry />} />

              {/* Rutas de lectura - accesibles en guest_mode */}
              <Route
                path="/radar"
                element={
                  <ProtectedRoute guestAllowed>
                    <Radar />
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
              <Route path="/grupos" element={<Home defaultMode="groups" hideToggle={true} />} />
              <Route
                path="/stats"
                element={
                  <ProtectedRoute guestAllowed>
                    <Stats />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute guestAllowed>
                    <Search />
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
              <Route path="/bracket" element={<OfficialBracket />} />
              <Route
                path="/tabla"
                element={
                  <ProtectedRoute guestAllowed>
                    <LeagueStandings />
                  </ProtectedRoute>
                }
              />

              {/* Rutas privadas - siempre requieren login real */}
              <Route
                path="/prediction"
                element={
                  <ProtectedRoute>
                    <Bracket />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/jornadas"
                element={
                  <ProtectedRoute>
                    <MatchdayPredictor />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;
