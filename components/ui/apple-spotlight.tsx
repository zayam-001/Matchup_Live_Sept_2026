'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  ChevronRight,
  Files,
  Folder,
  Globe,
  Image,
  LayoutGrid,
  Mail,
  MessageSquare,
  Music,
  Search,
  Settings,
  StickyNote,
  Terminal,
  Twitter,
  Trophy,
  Users,
  MapPin
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface Shortcut {
  label: string;
  icon: React.ReactNode;
  link?: string;
  onClick?: () => void;
}

export interface SearchResult {
  icon: React.ReactNode;
  label: string;
  description: string;
  link?: string;
  onClick?: () => void;
  badge?: string;
  category?: string;
  image?: string;
}

const SVGFilter = () => {
  return (
    <svg width="0" height="0" className="absolute invisible pointer-events-none">
      <filter id="blob">
        <feGaussianBlur stdDeviation="10" in="SourceGraphic" />
        <feColorMatrix
          values="
      1 0 0 0 0
      0 1 0 0 0
      0 0 1 0 0
      0 0 0 18 -9
    "
          result="blob"
        />
        <feBlend in="SourceGraphic" in2="blob" />
      </filter>
    </svg>
  );
};

interface ShortcutButtonProps {
  icon: React.ReactNode;
  link?: string;
  onClick?: () => void;
  label?: string;
}

const ShortcutButton = ({ icon, link, onClick, label }: ShortcutButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const content = (
    <div 
      className="rounded-full cursor-pointer hover:shadow-lg opacity-40 hover:opacity-100 transition-[opacity,shadow,transform] duration-200 hover:scale-105 active:scale-95 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-xl border border-black/5 dark:border-white/10"
      title={label}
    >
      <div className="size-16 aspect-square flex items-center justify-center text-neutral-800 dark:text-white">
        {icon}
      </div>
    </div>
  );

  if (onClick && !link) {
    return (
      <button type="button" onClick={handleClick} className="outline-none border-none bg-transparent p-0 cursor-pointer">
        {content}
      </button>
    );
  }

  return (
    <a 
      href={link || '#'} 
      onClick={handleClick}
      target={link?.startsWith('http') ? '_blank' : undefined}
      rel={link?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {content}
    </a>
  );
};

interface SpotlightPlaceholderProps {
  text: string;
  className?: string;
}

const SpotlightPlaceholder = ({ text, className }: SpotlightPlaceholderProps) => {
  return (
    <motion.div
      layout
      className={cn('absolute text-gray-500 flex items-center pointer-events-none z-10', className)}
    >
      <AnimatePresence mode="popLayout">
        <motion.p
          layoutId={`placeholder-${text}`}
          key={`placeholder-${text}`}
          initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
};

interface SpotlightInputProps {
  placeholder: string;
  hidePlaceholder: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholderClassName?: string;
}

const SpotlightInput = ({
  placeholder,
  hidePlaceholder,
  value,
  onChange,
  placeholderClassName
}: SpotlightInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the component mounts
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center w-full justify-start gap-3 px-6 h-16">
      <motion.div layoutId="search-icon" className="text-neutral-500 dark:text-neutral-300 shrink-0">
        <Search className="size-6" />
      </motion.div>
      <div className="flex-1 relative text-xl sm:text-2xl">
        {!hidePlaceholder && (
          <SpotlightPlaceholder text={placeholder} className={placeholderClassName} />
        )}

        <motion.input
          ref={inputRef}
          layout="position"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent outline-none ring-none border-none text-neutral-900 dark:text-white font-medium"
        />
      </div>
    </div>
  );
};

interface SearchResultCardProps extends SearchResult {
  isLast: boolean;
  onSelect?: () => void;
}

const SearchResultCard = ({ icon, label, description, link, onClick, badge, image, isLast, onSelect }: SearchResultCardProps) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
    if (onSelect) {
      onSelect();
    }
  };

  const content = (
    <div
      className={cn(
        'flex items-center text-black dark:text-white justify-start hover:bg-white dark:hover:bg-neutral-800/80 gap-3 py-2.5 px-3 rounded-xl hover:shadow-md w-full transition-all duration-150',
        isLast && 'rounded-b-3xl'
      )}
    >
      {image ? (
        <img
          src={image}
          alt={label}
          referrerPolicy="no-referrer"
          className="size-9 aspect-square object-cover rounded-lg shrink-0 border border-black/10 dark:border-white/10"
        />
      ) : (
        <div className="size-9 [&_svg]:stroke-[1.6] [&_svg]:size-5 aspect-square flex items-center justify-center shrink-0 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 group-hover/card:bg-brand/10 group-hover/card:text-brand transition-colors">
          {icon}
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate text-neutral-900 dark:text-white">{label}</p>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/15 text-brand shrink-0">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs opacity-60 truncate text-neutral-600 dark:text-neutral-300">{description}</p>
      </div>
      <div className="flex items-center justify-end opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 text-neutral-400 group-hover/card:text-neutral-900 dark:group-hover/card:text-white shrink-0">
        <ChevronRight className="size-5" />
      </div>
    </div>
  );

  if (onClick && !link) {
    return (
      <div onClick={handleClick} className="overflow-hidden w-full group/card cursor-pointer">
        {content}
      </div>
    );
  }

  return (
    <a 
      href={link || '#'} 
      onClick={handleClick}
      target={link?.startsWith('http') ? '_blank' : undefined} 
      rel={link?.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="overflow-hidden w-full group/card block cursor-pointer"
    >
      {content}
    </a>
  );
};

interface SearchResultsContainerProps {
  searchResults: SearchResult[];
  onHover: (index: number | null) => void;
  onSelectResult?: (result: SearchResult) => void;
}

const SearchResultsContainer = ({ searchResults, onHover, onSelectResult }: SearchResultsContainerProps) => {
  return (
    <motion.div
      layout
      onMouseLeave={() => onHover(null)}
      className="px-2 border-t border-black/5 dark:border-white/10 flex flex-col bg-neutral-100/95 dark:bg-neutral-900/95 backdrop-blur-xl max-h-96 overflow-y-auto w-full py-2"
    >
      {searchResults.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 text-xs font-semibold">
          No matches found
        </div>
      ) : (
        searchResults.map((result, index) => {
          return (
            <motion.div
              key={`search-result-${index}-${result.label}`}
              onMouseEnter={() => onHover(index)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                delay: Math.min(index * 0.04, 0.3),
                duration: 0.2,
                ease: 'easeOut'
              }}
            >
              <SearchResultCard
                icon={result.icon}
                label={result.label}
                description={result.description}
                link={result.link}
                onClick={result.onClick}
                badge={result.badge}
                image={result.image}
                isLast={index === searchResults.length - 1}
                onSelect={() => onSelectResult && onSelectResult(result)}
              />
            </motion.div>
          );
        })
      )}
    </motion.div>
  );
};

export interface AppleSpotlightProps {
  shortcuts?: Shortcut[];
  searchResults?: SearchResult[];
  isOpen?: boolean;
  handleClose?: () => void;
  placeholder?: string;
  value?: string;
  onSearchChange?: (val: string) => void;
  onSelectResult?: (result: SearchResult) => void;
}

const defaultShortcuts: Shortcut[] = [
  {
    label: 'Spectator',
    icon: <Trophy />,
    link: '#live'
  },
  {
    label: 'Tournaments',
    icon: <LayoutGrid />,
    link: '#register'
  },
  {
    label: 'Live Matches',
    icon: <Activity />,
    link: '#live'
  },
  {
    label: 'Leaderboard',
    icon: <Users />,
    link: '#global-leaderboard'
  }
];

const defaultSearchResults: SearchResult[] = [
  {
    icon: <Trophy />,
    label: 'National Padel Championship 2026',
    description: 'Premier Division • Finals Arena • Center Court',
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=150&auto=format&fit=crop&q=80',
    badge: 'LIVE',
    category: 'Tournament',
    link: '#live'
  },
  {
    icon: <Activity />,
    label: 'Court 1: Ali & Omar vs Hassan & Bilal',
    description: 'Quarter Final • 6-4, 3-2 • Live Court Feed',
    image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=150&auto=format&fit=crop&q=80',
    badge: 'IN PROGRESS',
    category: 'Match',
    link: '#live'
  },
  {
    icon: <Users />,
    label: 'Karachi Padel Club Masters',
    description: 'Open Doubles Tournament • Registration Open',
    image: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=150&auto=format&fit=crop&q=80',
    badge: 'Upcoming',
    category: 'Tournament',
    link: '#register'
  },
  {
    icon: <Image />,
    label: 'Lahore Arena Cup Highlights',
    description: 'High-speed action rally clips & championship trophy ceremony',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=150&auto=format&fit=crop&q=80',
    category: 'Media',
    link: '#live'
  },
  {
    icon: <Calendar />,
    label: 'Islamabad Winter Slam',
    description: 'Scheduled for December • Tier 1 Gold Event',
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=150&auto=format&fit=crop&q=80',
    badge: 'Dec 2026',
    category: 'Tournament',
    link: '#register'
  }
];

const AppleSpotlight = ({
  shortcuts = defaultShortcuts,
  searchResults: customSearchResults,
  isOpen = true,
  handleClose = () => {},
  placeholder = 'Search',
  value: controlledValue,
  onSearchChange,
  onSelectResult
}: AppleSpotlightProps) => {
  const [hovered, setHovered] = useState(false);
  const [hoveredSearchResult, setHoveredSearchResult] = useState<number | null>(null);
  const [hoveredShortcut, setHoveredShortcut] = useState<number | null>(null);
  const [internalSearchValue, setInternalSearchValue] = useState('');

  const searchValue = controlledValue !== undefined ? controlledValue : internalSearchValue;

  const handleSearchValueChange = (value: string) => {
    setInternalSearchValue(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  // Keyboard shortcut listener to close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Determine active search results dynamically
  const activeSearchResults: SearchResult[] = React.useMemo(() => {
    const baseList = customSearchResults || defaultSearchResults;
    if (!searchValue || !searchValue.trim()) {
      return baseList;
    }
    const q = searchValue.toLowerCase().trim();
    return baseList.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  }, [customSearchResults, searchValue]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{
            opacity: 0,
            filter: 'blur(20px) url(#blob)',
            scaleX: 1.3,
            scaleY: 1.1,
            y: -10
          }}
          animate={{
            opacity: 1,
            filter: 'blur(0px) url(#blob)',
            scaleX: 1,
            scaleY: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            filter: 'blur(20px) url(#blob)',
            scaleX: 1.3,
            scaleY: 1.1,
            y: 10
          }}
          transition={{
            stiffness: 550,
            damping: 50,
            type: 'spring'
          }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={handleClose}
        >
          <SVGFilter />

          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
              setHovered(false);
              setHoveredShortcut(null);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ filter: 'url(#blob)' }}
            className={cn(
              'w-full flex items-center justify-end gap-3 sm:gap-4 z-20 group relative',
              '[&>div]:bg-neutral-100/95 dark:[&>div]:bg-neutral-900/95 [&>div]:text-black dark:[&>div]:text-white [&>div]:rounded-full [&>div]:backdrop-blur-2xl',
              '[&_svg]:size-7 [&_svg]:stroke-[1.4]',
              'max-w-3xl'
            )}
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                layoutId="search-input-container"
                transition={{
                  layout: {
                    duration: 0.5,
                    type: 'spring',
                    bounce: 0.2
                  }
                }}
                style={{
                  borderRadius: '30px'
                }}
                className="h-full w-full flex flex-col items-center justify-start z-10 relative shadow-2xl overflow-hidden border border-black/10 dark:border-white/20 bg-neutral-100/95 dark:bg-neutral-900/95"
              >
                <SpotlightInput
                  placeholder={
                    hoveredShortcut !== null && shortcuts[hoveredShortcut]
                      ? shortcuts[hoveredShortcut].label
                      : hoveredSearchResult !== null && activeSearchResults[hoveredSearchResult]
                      ? activeSearchResults[hoveredSearchResult].label
                      : placeholder
                  }
                  placeholderClassName={
                    hoveredSearchResult !== null ? 'text-black dark:text-white bg-white/60 dark:bg-neutral-800/60 px-1 rounded' : 'text-gray-500'
                  }
                  hidePlaceholder={!(hoveredSearchResult !== null || !searchValue)}
                  value={searchValue}
                  onChange={handleSearchValueChange}
                />

                {searchValue && (
                  <SearchResultsContainer
                    searchResults={activeSearchResults}
                    onHover={setHoveredSearchResult}
                    onSelectResult={(res) => {
                      if (onSelectResult) onSelectResult(res);
                      handleClose();
                    }}
                  />
                )}
              </motion.div>
              {hovered &&
                !searchValue &&
                shortcuts.map((shortcut, index) => (
                  <motion.div
                    key={`shortcut-${index}-${shortcut.label}`}
                    onMouseEnter={() => setHoveredShortcut(index)}
                    layout
                    initial={{ scale: 0.7, x: -1 * (64 * (index + 1)) }}
                    animate={{ scale: 1, x: 0 }}
                    exit={{
                      scale: 0.7,
                      x:
                        1 *
                        (16 * (shortcuts.length - index - 1) + 64 * (shortcuts.length - index - 1))
                    }}
                    transition={{
                      duration: 0.8,
                      type: 'spring',
                      bounce: 0.2,
                      delay: index * 0.05
                    }}
                    className="rounded-full cursor-pointer shrink-0 hidden sm:block"
                  >
                    <ShortcutButton 
                      icon={shortcut.icon} 
                      link={shortcut.link} 
                      onClick={() => {
                        if (shortcut.onClick) shortcut.onClick();
                        handleClose();
                      }}
                      label={shortcut.label}
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export { AppleSpotlight };
