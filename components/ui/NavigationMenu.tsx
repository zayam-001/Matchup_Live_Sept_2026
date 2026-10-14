import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Users } from 'lucide-react';
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

  // Keep the page underneath from scrolling while the menu covers it.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

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

  // Opacity/transform only: these run on the compositor. The old version
  // animated clip-path with an under-damped spring over a full-screen
  // backdrop-blur, which re-blurred the live page behind it every frame and
  // flickered (and kept flickering while live scores updated underneath).
  const EASE_OUT = [0.22, 1, 0.36, 1] as const;
  const overlayVariants = {
    closed: { opacity: 0, transition: { duration: 0.2, ease: EASE_OUT } },
    open: { opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } },
  };
  const listVariants = {
    closed: {},
    open: { transition: { delayChildren: 0.05, staggerChildren: 0.05 } },
  };
  const itemVariants = {
    closed: { opacity: 0, y: 16 },
    open: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
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
            variants={overlayVariants}
            className="fixed inset-0 bg-[#050818] z-[9998] flex flex-col pointer-events-auto overflow-y-auto overscroll-contain"
            style={{ willChange: 'opacity' }}
            role="dialog"
            aria-modal="true"
          >
            {/* Brand glow: a static gradient instead of a 120px blur filter (cheap to paint, no repaint flicker) */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(circle at 85% 0%, rgba(230,92,49,0.14), transparent 45%)' }}
            />

            <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-8">
              <MatchupLogo className="h-7 sm:h-8 w-auto opacity-90" />
            </div>

            <motion.ul variants={listVariants} className="relative z-10 flex flex-col w-full px-6 sm:px-10 py-14 flex-1 justify-center max-w-3xl mx-auto">
              {menuItems.map((item, i) => (
                <motion.li
                  key={item.id}
                  variants={itemVariants}
                  className="border-t border-white/10 first:border-t-0"
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
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
