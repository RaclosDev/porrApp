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

const ProtectedRoute = ({ children }) => {
  const { isAdminAuthenticated } = useAppContext();
  const location = useLocation();

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
            
            <Route path="/radar" element={<ProtectedRoute><Radar /></ProtectedRoute>} />
            <Route path="/clasificacion" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/bracket" element={<ProtectedRoute><Bracket /></ProtectedRoute>} />
            <Route path="/cuadro" element={<OfficialBracket />} />
            <Route path="/mis-ligas" element={<ProtectedRoute><GroupsDashboard /></ProtectedRoute>} />
            <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;
