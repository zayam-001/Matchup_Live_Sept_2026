import React, { useState, useEffect } from 'react';
import { Layout } from './components/ui/Layout';
import { LiveScoreboard } from './components/LiveScoreboard';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminDashboard } from './components/AdminDashboard';
import { RefereeInterface } from './components/RefereeInterface';
import LiveScoringPage from './components/LiveScoringPage';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Auth } from './components/Auth';
import { PlayerDashboard } from './components/PlayerDashboard';
import { PublicLanding } from './components/PublicLanding';
import { QuickPlay } from './components/QuickPlay';
import { Onboarding } from './components/Onboarding';
import { CourtLeaderboard } from './components/CourtLeaderboard';
import { GlobalLeaderboard } from './components/GlobalLeaderboard';
import { TournamentLeaderboard } from './components/TournamentLeaderboard';
import { CourtDashboard } from './components/CourtDashboard';
import { QuickPlaySetup } from './components/QuickPlaySetup';
import { QuickPlaySession } from './components/QuickPlaySession';
import OBSOverlay from './components/OBSOverlay';
import { useAuth } from './hooks/useAuth';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db, auth } from './services/storage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('landing');
  const { user, loading, setUser } = useAuth();
  const isAuthenticated = !!user;
  
  // Role-based auth state
  const [adminAuthenticated, setAdminAuthenticated] = useState(() => {
    const session = localStorage.getItem('admin_session');
    if (!session) return false;
    const { timestamp } = JSON.parse(session);
    return Date.now() - timestamp < 24 * 60 * 60 * 1000;
  });
  
  const [refereeAuthenticated, setRefereeAuthenticated] = useState(() => {
    const session = localStorage.getItem('referee_session');
    if (!session) return false;
    const { timestamp } = JSON.parse(session);
    return Date.now() - timestamp < 12 * 60 * 60 * 1000;
  });
  
  const [refereeTournamentId, setRefereeTournamentId] = useState<string | undefined>(() => {
    const session = localStorage.getItem('referee_session');
    if (!session) return undefined;
    return JSON.parse(session).tournamentId;
  });

  const [registrationTournamentId, setRegistrationTournamentId] = useState<string | undefined>();
  const [liveTournamentId, setLiveTournamentId] = useState<string | undefined>();
  const [liveCategoryId, setLiveCategoryId] = useState<string | undefined>();
  const [obsMatchId, setObsMatchId] = useState<string | undefined>();
  const [obsTournamentId, setObsTournamentId] = useState<string | undefined>();

  // Hash-based routing with role guards
  useEffect(() => {
    if (loading) return;

    const handleHashChange = () => {
      // Map pathnames to hash routes for compatibility with QR codes or direct links
      const currentPath = window.location.pathname;
      const urlParams = window.location.search; // keep the query params

      if (currentPath === '/signup') {
         window.location.replace(`${window.location.origin}/#auth-player`);
         return;
      }

      if (currentPath.startsWith('/quick-play')) {
         // Transform /quick-play?court=abc to #quick-play?court=abc
         window.location.replace(`${window.location.origin}/#quick-play${urlParams}`);
         return;
      }

      if (currentPath.startsWith('/obs/')) {
         const obsRest = currentPath.replace(/^\/obs\//, '');
         window.location.replace(`${window.location.origin}/#obs/${obsRest}`);
         return;
      }

      // Check if it's a dynamic tournament path route like /register/tournament-slug or /tournament/slug
      if (currentPath.startsWith('/register/') || currentPath.startsWith('/tournament/')) {
         const slug = currentPath.split('/').pop();
         window.location.replace(`${window.location.origin}/#tournament/${slug}`);
         return;
      }
      
      // Some QR scanners might also encode hash into query params incorrectly or drop them. 
      // The mapping above ensures path-based URLs route correctly to hash.

      // Decode the hash to handle URL-encoded characters from QR scanners
      let rawHash = window.location.hash;
      try {
        rawHash = decodeURIComponent(rawHash);
      } catch (e) {
        // Ignore decode errors
      }
      
      // Remove leading #, optional leading /, and optional trailing /
      const fullHash = rawHash.replace(/^#\/?/, '').replace(/\/$/, '');
      const pathPart = fullHash.split('?')[0];
      const segments = pathPart.split('/').filter(Boolean);
      const hash = segments[0] || 'landing';
      
      // Handle dynamic routes
      if ((hash === 'register' || hash === 'tournament') && segments[1]) {
        setRegistrationTournamentId(segments[1]);
        if (hash === 'tournament') {
            // We use standard registration component for tournament details
            setActiveTab('register');
            return;
        }
      } else if (hash === 'register') {
        setRegistrationTournamentId(undefined);
      }

      if (hash === 'referee' && segments[1]) {
        setRefereeTournamentId(segments[1]);
      }

      if (hash === 'live') {
        if (segments[1]) {
          setLiveTournamentId(segments[1]);
        } else {
          setLiveTournamentId(undefined);
        }
        if (segments[2]) {
          setLiveCategoryId(segments[2]);
        } else {
          setLiveCategoryId(undefined);
        }
      }
      
      if (hash === 'obs') {
        // Pattern 1: #obs/tournamentId/matchId
        // Pattern 2: #obs/matchId (legacy fallback)
        if (segments.length >= 3) {
            setObsTournamentId(segments[1]);
            setObsMatchId(segments[2]);
        } else if (segments.length === 2) {
            setObsTournamentId(undefined);
            setObsMatchId(segments[1]);
        }
        setActiveTab('obs');
        return;
      }

      // Allow quick-play, leaderboard, court-dashboard, live without auth
      if (['quick-play', 'quick-play-setup', 'quick-play-session', 'leaderboard', 'court-dashboard', 'onboarding', 'live', 'global-leaderboard', 'tournament-leaderboard'].includes(hash)) {
        setActiveTab(hash);
        return;
      }

      // Role-based route guards
      const publicTabs = ['landing', 'live', 'register', 'leaderboard', 'court-dashboard', 'onboarding', 'privacy', 'quick-play', 'quick-play-session', 'global-leaderboard', 'tournament-leaderboard'];
      
      const isPublic = publicTabs.includes(hash);

      // If they are on a role tab they are authenticated for, allow it.
      if ((hash === 'admin' && adminAuthenticated) ||
          (hash === 'referee' && refereeAuthenticated) ||
          (hash === 'player' && isAuthenticated)) {
          setActiveTab(hash);
          return;
      }

      // Otherwise, if they are not on a public tab, redirect to their highest privilege role
      if (!isPublic) {
          if (adminAuthenticated) {
              window.location.hash = 'admin';
              return;
          }
          if (refereeAuthenticated) {
              window.location.hash = 'referee';
              return;
          }
          if (isAuthenticated && ['admin', 'referee', 'auth', 'auth-player', 'auth-admin'].includes(hash)) {
              window.location.hash = 'player';
              return;
          }
          if (!isAuthenticated && ['player', 'admin', 'referee', 'auth'].includes(hash)) {
              window.location.hash = 'auth-player';
              return;
          }
      }

      if (hash === 'auth-player' || hash === 'auth-admin') {
        setActiveTab(hash);
        return;
      }

      setActiveTab(hash);
    };

    // Check initial hash
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated, adminAuthenticated, refereeAuthenticated, loading]);

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    window.location.hash = tab;
  };

  const handleAuthSuccess = (role: 'player' | 'admin' | 'referee', tournamentId?: string) => {
    if (role === 'player') {
      const redirect = sessionStorage.getItem('postAuthRedirect');
      if (redirect) {
        sessionStorage.removeItem('postAuthRedirect');
        window.location.hash = redirect;
      } else {
        window.location.hash = 'player';
      }
    } else if (role === 'admin') {
      setAdminAuthenticated(true);
      window.location.hash = 'admin';
    } else if (role === 'referee') {
      setRefereeAuthenticated(true);
      setRefereeTournamentId(tournamentId);
      window.location.hash = 'referee';
    }
  };

  const handleLogout = async () => {
    try {
      await auth?.signOut();
    } catch (e) {}
    localStorage.removeItem('player_session');
    localStorage.removeItem('admin_session');
    localStorage.removeItem('referee_session');
    setAdminAuthenticated(false);
    setRefereeAuthenticated(false);
    setRefereeTournamentId(undefined);
    window.location.hash = 'landing';
    window.location.reload();
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (activeTab === 'obs') {
    if (!obsMatchId) {
      return <div className="min-h-screen bg-bg-dark flex items-center justify-center text-white">Invalid OBS Link</div>;
    }
    return <OBSOverlay tournamentId={obsTournamentId} matchId={obsMatchId} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={handleTabChange} 
      isAuthenticated={isAuthenticated}
      adminAuthenticated={adminAuthenticated}
      refereeAuthenticated={refereeAuthenticated}
      onLogout={handleLogout}
    >
      {activeTab === 'landing' && <PublicLanding onNavigate={handleTabChange} />}
      {activeTab === 'live' && <LiveScoreboard initialTournamentId={liveTournamentId} initialCategoryId={liveCategoryId} />}
      {activeTab === 'register' && <RegistrationForm initialTournamentId={registrationTournamentId} />}
      {activeTab === 'admin' && <AdminDashboard initialAuthenticated={adminAuthenticated} onLogout={handleLogout} />}
      {activeTab === 'referee' && <RefereeInterface initialTournamentId={refereeTournamentId} initialAuthenticated={refereeAuthenticated} onLogout={handleLogout} />}
      {activeTab === 'privacy' && <PrivacyPolicy onBack={() => handleTabChange('landing')} />}
      {activeTab === 'auth-player' && <Auth initialMode="player" onAuthSuccess={handleAuthSuccess} />}
      {activeTab === 'auth-admin' && <Auth initialMode="operations" tournamentId={refereeTournamentId} onAuthSuccess={handleAuthSuccess} />}
      {activeTab === 'player' && isAuthenticated && <PlayerDashboard onLogout={handleLogout} onNavigate={handleTabChange} />}
      {activeTab === 'quick-play' && <QuickPlay />}
      {activeTab === 'quick-play-setup' && <QuickPlaySetup />}
      {activeTab === 'quick-play-session' && <QuickPlaySession />}
      {activeTab === 'onboarding' && <Onboarding onComplete={(u) => { 
        setUser(u); 
        const redirect = sessionStorage.getItem('postAuthRedirect');
        if (redirect) {
          sessionStorage.removeItem('postAuthRedirect');
          window.location.hash = redirect;
        } else {
          handleTabChange('quick-play'); 
        }
      }} />}
      {activeTab === 'leaderboard' && <CourtLeaderboard />}
      {activeTab === 'global-leaderboard' && <GlobalLeaderboard />}
      {activeTab === 'tournament-leaderboard' && <TournamentLeaderboard />}
      {activeTab === 'court-dashboard' && <CourtDashboard />}
    </Layout>
  );
};

export default App;