import React, { useState, useRef, useEffect } from 'react';
import { Trophy, Video, Activity, Users, LogOut, MessageCircle, ClipboardList, Lock, ExternalLink, Eye, Menu, X, ChevronRight, Search, Bell, User, ChevronDown, Home, Key, Zap, Compass, Shield } from 'lucide-react';
import { Badge } from './Badge';
import { Sheet } from './Sheet';
import { Logo } from './Logo';
import { auth, subscribeToTournaments } from '../../services/storage';
import { NavigationMenu } from './NavigationMenu';
import { CinematicFooter } from './motion-footer';
import { AppleSpotlight, SearchResult, Shortcut } from './apple-spotlight';
import { Tournament } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAuthenticated?: boolean;
  adminAuthenticated?: boolean;
  refereeAuthenticated?: boolean;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, isAuthenticated, adminAuthenticated, refereeAuthenticated, onLogout }) => {
  const [showOrganizerForm, setShowOrganizerForm] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    const unsub = subscribeToTournaments((list) => {
      setTournaments(list || []);
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getNavItems = () => {
    if (adminAuthenticated) {
      return [
        { label: 'Dashboard', id: 'admin', icon: <Activity /> },
        { label: 'Tournaments', id: 'register', icon: <Users /> },
      ];
    } else if (refereeAuthenticated) {
      return [
        { label: 'Dashboard', id: 'referee', icon: <ClipboardList /> },
        { label: 'Tournaments', id: 'register', icon: <Users /> },
      ];
    }
    
    // Player or Public
    const items = [
      { label: 'Home', id: 'landing', icon: <Home /> },
      { label: 'Spectator', id: 'live', icon: <Trophy /> },
      { label: 'Tournaments', id: 'register', icon: <Users /> },
    ];
    if (isAuthenticated) {
      items.push({ label: 'Dashboard', id: 'player', icon: <ClipboardList /> });
    }
    return items;
  };

  const navItems = getNavItems();

  // Dynamic search results across the entire app
  const spotlightSearchResults: SearchResult[] = React.useMemo(() => {
    const appSections: SearchResult[] = [
      {
        icon: <Trophy className="text-amber-400" />,
        label: 'Live Spectator Arena',
        description: 'Watch real-time padel tournament matches, scores, and brackets',
        category: 'Section',
        badge: 'Live',
        onClick: () => {
          onTabChange('live');
          setIsSpotlightOpen(false);
        }
      },
      {
        icon: <Users className="text-blue-400" />,
        label: 'Tournament Registry',
        description: 'Browse upcoming competitions, register teams, and view draws',
        category: 'Section',
        onClick: () => {
          onTabChange('register');
          setIsSpotlightOpen(false);
        }
      },
      {
        icon: <Zap className="text-emerald-400" />,
        label: 'Quick Play Session',
        description: 'Instant court scorekeeper and casual match session logger',
        category: 'Feature',
        onClick: () => {
          onTabChange('quick-play');
          setIsSpotlightOpen(false);
        }
      },
      {
        icon: <Compass className="text-purple-400" />,
        label: 'Global Player Leaderboard',
        description: 'Check national ELO rankings, player stats, and win ratios',
        category: 'Rankings',
        onClick: () => {
          onTabChange('global-leaderboard');
          setIsSpotlightOpen(false);
        }
      },
      {
        icon: <Activity className="text-red-400" />,
        label: 'Court Live Leaderboard',
        description: 'Real-time venue court standings and court activity stream',
        category: 'Courts',
        onClick: () => {
          onTabChange('court-dashboard');
          setIsSpotlightOpen(false);
        }
      }
    ];

    if (isAuthenticated) {
      appSections.push({
        icon: <ClipboardList className="text-indigo-400" />,
        label: 'My Player Dashboard',
        description: 'View your tournament history, match results, and personal ELO',
        category: 'Profile',
        onClick: () => {
          onTabChange('player');
          setIsSpotlightOpen(false);
        }
      });
    }

    if (adminAuthenticated) {
      appSections.push({
        icon: <Shield className="text-orange-400" />,
        label: 'Command Center & Admin Operations',
        description: 'Tournament management, match scheduler, and player merge',
        category: 'Admin',
        badge: 'Staff',
        onClick: () => {
          onTabChange('admin');
          setIsSpotlightOpen(false);
        }
      });
    }

    // Dynamic tournament cards
    const tournamentResults: SearchResult[] = tournaments.map((t) => ({
      icon: <Trophy className="text-amber-500" />,
      label: t.name,
      description: `${t.venue || t.city || 'Padel Arena'} • ${t.format || 'Tournament'} • ${t.status || 'Active'}`,
      category: 'Tournament',
      badge: t.status === 'ACTIVE' ? 'LIVE' : t.status,
      onClick: () => {
        window.location.hash = `live/${t.slug || t.id}`;
        onTabChange('live');
        setIsSpotlightOpen(false);
      }
    }));

    return [...appSections, ...tournamentResults];
  }, [tournaments, isAuthenticated, adminAuthenticated, onTabChange]);

  const spotlightShortcuts: Shortcut[] = [
    {
      label: 'Spectator',
      icon: <Trophy />,
      onClick: () => {
        onTabChange('live');
        setIsSpotlightOpen(false);
      }
    },
    {
      label: 'Tournaments',
      icon: <Users />,
      onClick: () => {
        onTabChange('register');
        setIsSpotlightOpen(false);
      }
    },
    {
      label: 'Quick Play',
      icon: <Zap />,
      onClick: () => {
        onTabChange('quick-play');
        setIsSpotlightOpen(false);
      }
    },
    {
      label: 'Rankings',
      icon: <Compass />,
      onClick: () => {
        onTabChange('global-leaderboard');
        setIsSpotlightOpen(false);
      }
    }
  ];

  return (
    <div className="min-h-screen bg-bg-dark text-white font-sans selection:bg-primary/30 selection:text-white flex flex-col overflow-hidden relative">

      {/* Global Apple Spotlight Search Component */}
      <AppleSpotlight
        isOpen={isSpotlightOpen}
        handleClose={() => setIsSpotlightOpen(false)}
        searchResults={spotlightSearchResults}
        shortcuts={spotlightShortcuts}
        placeholder="Search tournaments, matches, leaderboards (⌘K)..."
      />
      
      {/* Top Navigation - Minimal for Desktop/Mobile since we use Fullscreen Menu */}
      {activeTab !== 'landing' && (
        <header className="fixed top-0 w-full h-16 md:h-24 flex items-center justify-between px-4 md:px-8 z-[10000] bg-transparent pointer-events-none border-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            {/* Logo Area */}
              <Logo size={40} className="shrink-0" />
            </div>
          
          <div className="pointer-events-auto flex items-center gap-2.5">
              {/* Apple Spotlight Trigger in Top Bar */}
              <button
                type="button"
                onClick={() => setIsSpotlightOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs text-zinc-300 hover:text-white transition-all shadow-md group cursor-pointer"
                title="Search everywhere (⌘K)"
              >
                <Search size={14} className="text-zinc-400 group-hover:text-brand transition-colors" />
                <span className="font-medium">Search</span>
                <kbd className="text-[10px] font-mono bg-white/10 text-zinc-400 px-1.5 py-0.5 rounded border border-white/10">⌘K</kbd>
              </button>

              <NavigationMenu
                  navItems={navItems}
                  activeTab={activeTab}
                  onTabChange={onTabChange}
                  isAuthenticated={isAuthenticated}
                  adminAuthenticated={adminAuthenticated}
                  refereeAuthenticated={refereeAuthenticated}
                  onLogout={() => {
                      auth?.signOut();
                      if (onLogout) onLogout();
                      else onTabChange('landing');
                  }}
              />
          </div>
        </header>
      )}

      {/* Main Content Wrapper */}
      <main id="main-scroll-container" className="flex-1 overflow-y-auto custom-scrollbar relative z-10 w-full bg-bg-dark shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="min-h-screen">
          {children}
        </div>
        
        {/* Render Footer only for public/player pages. Not admin/referee if preferred, but let's do it globally for now or only if activeTab is landing */}
        {(activeTab === 'quick-play' || activeTab === 'leaderboard') && (
            <CinematicFooter />
        )}
      </main>

      {/* Organizer Form Sheet */}
      <Sheet isOpen={showOrganizerForm} onClose={() => setShowOrganizerForm(false)} title="Partner With Us" description="Bring your venue or tournament to MatchUp.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowOrganizerForm(false); }}>
          <div>
            <label className="block text-xs font-bold text-content-muted uppercase tracking-widest mb-2">Organization Name</label>
            <input type="text" className="w-full bg-surface-dark border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none" placeholder="e.g. Karachi Padel Club" />
          </div>
          <div>
            <label className="block text-xs font-bold text-content-muted uppercase tracking-widest mb-2">Contact Email</label>
            <input type="email" className="w-full bg-surface-dark border border-white/10 rounded-xl p-3 text-white focus:border-primary outline-none" placeholder="hello@example.com" />
          </div>
          <button type="submit" className="w-full bg-primary text-white shadow-[0_4px_14px_0_rgba(77,120,255,0.39)] font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors mt-4">
            Request Access
          </button>
        </form>
      </Sheet>
    </div>
  );
};