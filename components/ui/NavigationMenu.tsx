import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Users, X } from 'lucide-react';
import { MenuToggleIcon } from './menu-toggle-icon';
import { MatchupLogo } from '../MatchupLogo';
import { cn } from '../../lib/utils';

interface NavigationMenuProps {
  navItems: { label: string; id: string; icon: React.ReactNode }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAuthenticated?: boolean;
  adminAuthenticated?: boolean;
  refereeAuthenticated?: boolean;
  onLogout?: () => void;
}

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  navItems,
  activeTab,
  onTabChange,
  isAuthenticated,
  adminAuthenticated,
  refereeAuthenticated,
  onLogout
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = (id: string) => {
    setIsOpen(false);
    setTimeout(() => {
      onTabChange(id);
    }, 200);
  };

  const handleActionClick = (action: () => void) => {
    setIsOpen(false);
    setTimeout(() => {
      action();
    }, 200);
  };

  const menuVariants: any = {
    closed: {
      opacity: 0,
      clipPath: "circle(0px at calc(100% - 40px) 40px)",
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 40
      }
    },
    open: {
      opacity: 1,
      clipPath: "circle(200% at calc(100% - 40px) 40px)",
      transition: {
        type: "spring" as const,
        stiffness: 20,
        restDelta: 2,
        duration: 0.5
      }
    }
  };

  const getMenuItems = () => {
    let items = navItems.map(item => ({
      label: item.label === 'Spectator' ? 'Spectators' : item.label === 'Tournaments' ? 'Tournament' : item.label,
      id: item.id,
      onClick: () => handleNavClick(item.id),
      isActive: activeTab === item.id,
      icon: item.icon
    }));

    if (!adminAuthenticated && !refereeAuthenticated) {
      items.push({
        label: 'Community',
        id: 'community',
        onClick: () => handleActionClick(() => window.open('https://chat.whatsapp.com/FmeRv7o6ZtH1iApVom78pG', '_blank')),
        isActive: false,
        icon: <Users />
      });
    }

    if (isAuthenticated || adminAuthenticated || refereeAuthenticated) {
      items.push({
        label: 'Logout',
        id: 'logout',
        onClick: () => handleActionClick(() => {
          if (onLogout) onLogout();
          else onTabChange('landing');
        }),
        isActive: false,
        icon: <LogOut />
      });
    } else {
      items.push({
        label: 'Sign In',
        id: 'signin',
        onClick: () => handleActionClick(() => {
          if (activeTab !== 'landing') {
            sessionStorage.setItem('postAuthRedirect', activeTab);
          }
          onTabChange('auth');
        }),
        isActive: activeTab === 'auth',
        icon: <LogIn />
      });
    }
    
    return items;
  };

  const menuItems = getMenuItems();

  return (
    <>
      <div className="pointer-events-none flex justify-end">
          <button
            className="pointer-events-auto"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Menu"
          >
            <div className={cn(
              "relative z-[9999] p-3 md:p-4 rounded-full bg-surface-dark border border-white/10 text-white transition-all shadow-xl hover:bg-neutral-800",
              isOpen && "bg-transparent border-transparent hover:bg-transparent shadow-none"
            )}>
              <MenuToggleIcon open={isOpen} className="w-8 h-8 md:w-10 md:h-10 text-white" duration={400} />
            </div>
          </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            className="fixed inset-0 bg-[#050818]/97 backdrop-blur-xl z-[9998] flex flex-col pointer-events-auto overflow-y-auto"
          >
            {/* Brand-consistent glow accent, matching the hero/final-cta treatment elsewhere on the site */}
            <div className="pointer-events-none absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-[#E65C31]/10 blur-[120px]" />

            <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-8">
              <MatchupLogo className="h-7 sm:h-8 w-auto opacity-90" />
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <ul className="relative z-10 flex flex-col w-full px-6 sm:px-10 py-14 flex-1 justify-center max-w-3xl mx-auto">
              {menuItems.map((item, i) => (
                <li
                  key={item.id}
                  className={cn(
                    "transition-all duration-500 transform border-t border-white/10 first:border-t-0",
                    isOpen ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                  )}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <button
                    onClick={item.onClick}
                    className="group relative flex items-center gap-4 sm:gap-6 w-full py-5 sm:py-6 text-left"
                  >
                    <span className="text-xs sm:text-sm font-mono font-bold text-[#E65C31] w-8 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-3xl sm:text-4xl md:text-5xl leading-none font-black tracking-tighter uppercase transition-colors duration-300 font-sans",
                        item.isActive ? "text-white" : "text-white/45 group-hover:text-white"
                      )}
                    >
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "w-10 h-10 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-5 sm:[&>svg]:h-5",
                        item.isActive
                          ? "bg-[#E65C31] border-[#E65C31] text-white"
                          : "bg-white/5 border-white/10 text-white/40 group-hover:border-[#E65C31]/50 group-hover:text-[#E65C31] group-hover:translate-x-1"
                      )}
                    >
                      {item.icon}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
