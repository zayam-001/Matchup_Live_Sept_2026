import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Users } from 'lucide-react';
import { MenuToggleIcon } from './menu-toggle-icon';
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
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[9998] flex flex-col justify-center items-center pointer-events-auto overflow-y-auto text-center"
          >
            <ul className="flex flex-col gap-4 sm:gap-6 md:gap-8 w-full px-6 py-20 h-full justify-center max-w-5xl mx-auto">
              {menuItems.map((item, i) => (
                <li
                  key={item.id}
                  className={cn(
                    "transition-all duration-500 transform w-full flex justify-center",
                    isOpen ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                  )}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <button
                    onClick={item.onClick}
                    className={cn(
                      "group relative flex items-center justify-center gap-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-none font-black tracking-tighter uppercase text-white/50 hover:text-white transition-all duration-300 font-sans",
                      item.isActive && "text-white"
                    )}
                  >
                    <span className="w-12 h-12 sm:w-14 sm:h-14 md:w-20 md:h-20 lg:w-28 lg:h-28 text-primary opacity-0 -translate-x-8 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 flex flex-shrink-0 items-center justify-center [&>svg]:w-full [&>svg]:h-full absolute -left-16 sm:-left-20 md:-left-28 lg:-left-36">
                      {item.icon}
                    </span>
                    {item.label}
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
