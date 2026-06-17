import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Rules from './pages/Rules';
import Leaderboard from './pages/Leaderboard';
import Home from './pages/Home';
import Radar from './pages/Radar';
import Bracket from './pages/Bracket';
import Stats from './pages/Stats';
import Search from './pages/Search';
import Admin from './pages/Admin';

function App() {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/clasificacion" element={<Leaderboard />} />
            <Route path="/bracket" element={<Bracket />} />
            <Route path="/radar" element={<Radar />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/search" element={<Search />} />
            <Route path="/reglas" element={<Rules />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;
