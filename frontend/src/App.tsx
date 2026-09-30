import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import PwaUpdater from './components/PwaUpdater';

const Rules = React.lazy(() => import('./pages/Rules'));
const Leaderboard = React.lazy(() => import('./pages/Leaderboard'));
const Home = React.lazy(() => import('./pages/Home'));
const Radar = React.lazy(() => import('./pages/Radar'));
const Bracket = React.lazy(() => import('./pages/Bracket'));
const Stats = React.lazy(() => import('./pages/Stats'));
const Search = React.lazy(() => import('./pages/Search'));
const Admin = React.lazy(() => import('./pages/Admin'));
const GroupsDashboard = React.lazy(() => import('./pages/GroupsDashboard'));
const JoinRedirect = React.lazy(() => import('./components/JoinRedirect'));
const OfficialBracket = React.lazy(() => import('./pages/OfficialBracket'));
const LinkedInEntry = React.lazy(() => import('./pages/LinkedInEntry'));

// Rutas que un visitante invitado (guest_mode) puede ver sin loguearse
const GUEST_ALLOWED_PATHS = [
  '/clasificacion',
  '/search',
  '/stats',
  '/radar',
  '/mis-ligas',
];

const ProtectedRoute = ({ children, guestAllowed = false }) => {
  const { isAdminAuthenticated } = useAppContext();
  const location = useLocation();
  const isGuest = localStorage.getItem('guest_mode') === 'true';

  // Invitado con permiso explícito o ruta en lista blanca
  if (isGuest && (guestAllowed || GUEST_ALLOWED_PATHS.includes(location.pathname))) {
    return children;
  }

  if (!isAdminAuthenticated) {
    return <Navigate to="/" state={{ requireLogin: true, from: location.pathname }} replace />;
  }
  return children;
};

function App() {
  return (
    <AppProvider>
      <Router>
        <PwaUpdater />
        <Layout>
          <Suspense fallback={<div className="flex justify-center p-8">Cargando...</div>}>
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/reglas" element={<Rules />} />
            <Route path="/join/:code" element={<JoinRedirect />} />
            <Route path="/linkedin" element={<LinkedInEntry />} />

            {/* Rutas de lectura — accesibles en guest_mode */}
            <Route path="/radar" element={<ProtectedRoute guestAllowed><Radar /></ProtectedRoute>} />
            <Route path="/clasificacion" element={<ProtectedRoute guestAllowed><Leaderboard /></ProtectedRoute>} />
            <Route path="/grupos" element={<Home defaultMode="groups" hideToggle={true} />} />
            <Route path="/stats" element={<ProtectedRoute guestAllowed><Stats /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute guestAllowed><Search /></ProtectedRoute>} />
            <Route path="/mis-ligas" element={<ProtectedRoute guestAllowed><GroupsDashboard /></ProtectedRoute>} />
            <Route path="/cuadro" element={<OfficialBracket />} />

            {/* Rutas privadas — siempre requieren login real */}
            <Route path="/bracket" element={<ProtectedRoute><Bracket /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;

