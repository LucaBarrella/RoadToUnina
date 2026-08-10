import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './hooks';
import Navbar from './components/ui/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = (): 'game' | 'leaderboard' | 'rules' => {
    if (location.pathname.startsWith('/leaderboard')) return 'leaderboard';
    if (location.pathname.startsWith('/game')) return 'game';
    return 'rules';
  };

  const handleNavigateTab = (tab: 'game' | 'leaderboard' | 'rules') => {
    if (tab === 'leaderboard') navigate('/leaderboard');
    else if (tab === 'game') navigate('/game');
    else navigate('/');
  };

  const handleOpenAuthModal = (mode: 'login' | 'register') => {
    if (mode === 'login') navigate('/login');
    else navigate('/register');
  };

  return (
    <div className="min-h-screen bg-neo-bg font-inter text-neo-black flex flex-col antialiased overflow-x-hidden w-full">
      <Navbar
        activeTab={getActiveTab()}
        onNavigateTab={handleNavigateTab}
        onOpenAuthModal={handleOpenAuthModal}
      />
      <div className="flex-1 flex flex-col w-full">{children}</div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
