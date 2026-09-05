import React, { useState, useRef, useEffect } from 'react';
import { Trophy, Video, Activity, Users, LogOut, MessageCircle, ClipboardList, Lock, ExternalLink, Eye, Menu, X, ChevronRight, Search, Bell, User, ChevronDown, Home, Key } from 'lucide-react';
import { Badge } from './Badge';
import { Sheet } from './Sheet';
import { Logo } from './Logo';
import { auth } from '../../services/storage';
import { NavigationMenu } from './NavigationMenu';
import { CinematicFooter } from './motion-footer';

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

  return (
    <div className="min-h-screen bg-bg-dark text-white font-sans selection:bg-primary/30 selection:text-white flex flex-col overflow-hidden relative">

      
      {/* Top Navigation - Minimal for Desktop/Mobile since we use Fullscreen Menu */}
      {activeTab !== 'landing' && (
        <header className="fixed top-0 w-full h-16 md:h-24 flex items-center justify-between px-4 md:px-8 z-[10000] bg-transparent pointer-events-none border-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            {/* Logo Area */}
              <Logo size={40} className="shrink-0" />
            </div>
          
          <div className="pointer-events-auto flex items-center">
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