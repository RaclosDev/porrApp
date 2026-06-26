import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import Rules from './pages/Rules';
import Leaderboard from './pages/Leaderboard';
import Home from './pages/Home';
import Radar from './pages/Radar';
import Bracket from './pages/Bracket';
import Stats from './pages/Stats';
import Search from './pages/Search';
import Admin from './pages/Admin';
import GroupsDashboard from './pages/GroupsDashboard';
import JoinRedirect from './components/JoinRedirect';
import OfficialBracket from './pages/OfficialBracket';
import LinkedInEntry from './pages/LinkedInEntry';

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
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/reglas" element={<Rules />} />
            <Route path="/join/:code" element={<JoinRedirect />} />
            <Route path="/linkedin" element={<LinkedInEntry />} />

            {/* Rutas de lectura — accesibles en guest_mode */}
            <Route path="/radar" element={<ProtectedRoute guestAllowed><Radar /></ProtectedRoute>} />
            <Route path="/clasificacion" element={<ProtectedRoute guestAllowed><Leaderboard /></ProtectedRoute>} />
            <Route path="/stats" element={<ProtectedRoute guestAllowed><Stats /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute guestAllowed><Search /></ProtectedRoute>} />
            <Route path="/mis-ligas" element={<ProtectedRoute guestAllowed><GroupsDashboard /></ProtectedRoute>} />
            <Route path="/cuadro" element={<OfficialBracket />} />

            {/* Rutas privadas — siempre requieren login real */}
            <Route path="/bracket" element={<ProtectedRoute><Bracket /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;
