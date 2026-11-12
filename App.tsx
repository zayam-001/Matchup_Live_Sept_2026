import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BootSplash } from './components/BootSplash';
import { Layout } from './components/ui/Layout';
import { PublicLanding } from './components/PublicLanding';
import { useAuth } from './hooks/useAuth';
import { auth } from './services/storage';

// Every screen except the landing page loads on demand, so the first visit
// downloads only what it shows (the admin panel alone is most of the app).
const named = <M, K extends keyof M>(load: () => Promise<M>, key: K) =>
  lazy(() => load().then(m => ({ default: m[key] as M[K] & React.ComponentType<any> })));
const LiveScoreboard = named(() => import('./components/LiveScoreboard'), 'LiveScoreboard');
const RegistrationForm = named(() => import('./components/RegistrationForm'), 'RegistrationForm');
const AdminDashboard = named(() => import('./components/AdminDashboard'), 'AdminDashboard');
const RefereeInterface = named(() => import('./components/RefereeInterface'), 'RefereeInterface');
const PrivacyPolicy = named(() => import('./components/PrivacyPolicy'), 'PrivacyPolicy');
const Auth = named(() => import('./components/Auth'), 'Auth');
const QuickPlay = named(() => import('./components/QuickPlay'), 'QuickPlay');
const Onboarding = named(() => import('./components/Onboarding'), 'Onboarding');
const CourtLeaderboard = named(() => import('./components/CourtLeaderboard'), 'CourtLeaderboard');
const GlobalLeaderboard = named(() => import('./components/GlobalLeaderboard'), 'GlobalLeaderboard');
const TournamentLeaderboard = named(() => import('./components/TournamentLeaderboard'), 'TournamentLeaderboard');
const CourtDashboard = named(() => import('./components/CourtDashboard'), 'CourtDashboard');
const QuickPlaySetup = named(() => import('./components/QuickPlaySetup'), 'QuickPlaySetup');
const QuickPlaySession = named(() => import('./components/QuickPlaySession'), 'QuickPlaySession');
const OBSOverlay = lazy(() => import('./components/OBSOverlay'));
const CourtOBS = lazy(() => import('./components/CourtOBS'));
const FutsalApp = lazy(() => import('./futsal/FutsalApp'));
const FutsalPortal = lazy(() => import('./futsal/ui/FutsalPortal'));
const QuickReferee = lazy(() => import('./futsal/ui/QuickPlay'));

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
  const [obsCourt, setObsCourt] = useState<string | undefined>();
  const [quickCode, setQuickCode] = useState<string | undefined>();

  // Hash-based routing with role guards
  useEffect(() => {
    if (loading) return;

    const handleHashChange = () => {
      // Map pathnames to hash routes for compatibility with QR codes or direct links
      const currentPath = window.location.pathname;
      const urlParams = window.location.search; // keep the query params

      if (currentPath === '/signup') {
         try { sessionStorage.setItem('mu_auth_intent', 'signup'); } catch { /* private mode */ }
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
        // Pattern 3: #obs/tournamentId/court/courtId - follows whatever is live on that court
        setObsCourt(undefined);
        if (segments.length >= 4 && segments[2] === 'court') {
            setObsTournamentId(segments[1]);
            setObsCourt(segments.slice(3).join('/'));
            setObsMatchId(undefined);
        } else if (segments.length >= 3) {
            setObsTournamentId(segments[1]);
            setObsMatchId(segments[2]);
        } else if (segments.length === 2) {
            setObsTournamentId(undefined);
            setObsMatchId(segments[1]);
        }
        setActiveTab('obs');
        return;
      }

      // Futsal organising now lives inside the organiser portal.
      if (hash.startsWith('futsal-admin')) {
        window.location.replace('#admin');
        return;
      }
      // Quick Play referee: #qp or #qp/<code>, open to anyone holding the code.
      if (hash === 'qp') {
        setQuickCode(segments[1]);
        setActiveTab('qp');
        return;
      }
      // Futsal and football share their own router and guards.
      if (hash.startsWith('futsal') || hash.startsWith('football')) {
        setActiveTab('futsal');
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
          ((hash === 'player' || hash === 'player-futsal') && isAuthenticated)) {
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
          if (!isAuthenticated && ['player', 'player-futsal', 'admin', 'referee', 'auth'].includes(hash)) {
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
    return <BootSplash />;
  }

  if (activeTab === 'futsal') {
    return <Suspense fallback={<BootSplash />}><FutsalApp organiserSignedIn={adminAuthenticated} /></Suspense>;
  }

  if (activeTab === 'qp') {
    return <Suspense fallback={<BootSplash />}><QuickReferee code={quickCode} /></Suspense>;
  }

  if (activeTab === 'obs') {
    // OBS pages stay transparent while they load: no splash over the stream.
    if (obsCourt && obsTournamentId) {
      return <Suspense fallback={null}><CourtOBS tournamentId={obsTournamentId} court={obsCourt} /></Suspense>;
    }
    if (!obsMatchId) {
      return <div className="min-h-screen bg-bg-dark flex items-center justify-center text-white">Invalid OBS Link</div>;
    }
    return <Suspense fallback={null}><OBSOverlay tournamentId={obsTournamentId} matchId={obsMatchId} /></Suspense>;
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
      <Suspense fallback={<BootSplash />}>
      {activeTab === 'landing' && <PublicLanding onNavigate={handleTabChange} />}
      {activeTab === 'live' && <LiveScoreboard initialTournamentId={liveTournamentId} initialCategoryId={liveCategoryId} />}
      {activeTab === 'register' && <RegistrationForm initialTournamentId={registrationTournamentId} />}
      {activeTab === 'admin' && <AdminDashboard initialAuthenticated={adminAuthenticated} onLogout={handleLogout} />}
      {activeTab === 'referee' && <RefereeInterface initialTournamentId={refereeTournamentId} initialAuthenticated={refereeAuthenticated} onLogout={handleLogout} />}
      {activeTab === 'privacy' && <PrivacyPolicy onBack={() => handleTabChange('landing')} />}
      {activeTab === 'auth-player' && <Auth initialMode="player" onAuthSuccess={handleAuthSuccess} />}
      {activeTab === 'auth-admin' && <Auth initialMode="operations" tournamentId={refereeTournamentId} onAuthSuccess={handleAuthSuccess} />}
      {/* One player portal for padel and futsal. */}
      {(activeTab === 'player' || activeTab === 'player-futsal') && isAuthenticated && user && (
        <FutsalPortal key={activeTab} account={user as any} onNavigate={handleTabChange} onLogout={handleLogout} initialPage={activeTab === 'player-futsal' ? 'overview' : 'home'} />
      )}
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
      {/* Court links carry ?court=...; everything else is the main leaderboard page. */}
      {activeTab === 'leaderboard' && (window.location.hash.includes('court=') ? <CourtLeaderboard /> : <GlobalLeaderboard />)}
      {activeTab === 'global-leaderboard' && <GlobalLeaderboard />}
      {activeTab === 'tournament-leaderboard' && <TournamentLeaderboard />}
      {activeTab === 'court-dashboard' && <CourtDashboard />}
      </Suspense>
    </Layout>
  );
};

export default App;