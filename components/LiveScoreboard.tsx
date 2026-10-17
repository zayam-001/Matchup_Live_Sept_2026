import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getFirestore, collection, collectionGroup, query, onSnapshot } from 'firebase/firestore';
import { db, sortSponsors, subscribeToTournaments, subscribeToStandings, isTeamInCategory, isMatchInCategory, calculateStats, checkAndHealTournamentStats } from '../services/storage';
import { useMatchResult } from '../hooks/useMatchResult';
import { useTournamentDoc } from '../hooks/useTournamentDoc';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import { MatchStatus, Tournament, TournamentFormat, RoundRobinType, Team, Match, SponsorTier, MatchEvent, BroadcastTheme } from '../types';
import { CountryFlag } from './CountrySelect';
import { Search, Filter, ChevronRight, ChevronLeft, Play, Info, Trophy, History, Timer, MapPin, Award, X, Activity, ChevronDown, Users, Mic, DollarSign, Tv, Calendar, Check, LayoutGrid, List } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Card } from './ui/Card';
import { Logo } from './ui/Logo';
import { Badge } from './ui/Badge';
import { getEffectiveEvents } from '../services/scoreEngine';
import { MatchResultCard } from './MatchResultCard';
import { TeamDetailsOverlay } from './TeamDetailsOverlay';
import { TournamentBannerCard } from './TournamentBannerCard';
import { motion, AnimatePresence } from 'motion/react';
import { TournamentDetail } from './TournamentDetail';
import { TeamAmericanoStandings } from './TeamAmericanoStandings';
import './spectator.css';
import { getActiveFormat, isTeamAmericanoFormat, isPointsScoredFormat } from '../lib/teamAmericano';

const getMatchTimestamp = (m: any): number => {
  const time = m.scheduledTime || m.scheduledAt;
  if (!time) return 0;
  if (typeof time === 'string' || typeof time === 'number') {
    const parsed = new Date(time).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  if (time.toDate && typeof time.toDate === 'function') {
    return time.toDate().getTime();
  }
  if (typeof time.seconds === 'number') {
    return time.seconds * 1000;
  }
  return 0;
};

const formatFullTime = (time: any) => {
  if (!time) return 'TBA';
  try {
    let date: Date;
    if (typeof time === 'string' || typeof time === 'number') {
      date = new Date(time);
    } else if (time.toDate && typeof time.toDate === 'function') {
      date = time.toDate();
    } else if (typeof time.seconds === 'number') {
      date = new Date(time.seconds * 1000);
    } else if (time instanceof Date) {
      date = time;
    } else {
      return 'TBA';
    }
    if (isNaN(date.getTime())) return 'TBA';
    return date.toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return 'TBA';
  }
};

const formatTimeOnly = (time: any) => {
  if (!time) return 'TBA';
  try {
    let date: Date;
    if (typeof time === 'string' || typeof time === 'number') {
      date = new Date(time);
    } else if (time.toDate && typeof time.toDate === 'function') {
      date = time.toDate();
    } else if (typeof time.seconds === 'number') {
      date = new Date(time.seconds * 1000);
    } else if (time instanceof Date) {
      date = time;
    } else {
      return 'TBA';
    }
    if (isNaN(date.getTime())) return 'TBA';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return 'TBA';
  }
};

const formatFullDateOnly = (time: any) => {
  if (!time) return 'Completed';
  try {
    let date: Date;
    if (typeof time === 'string' || typeof time === 'number') {
      date = new Date(time);
    } else if (time.toDate && typeof time.toDate === 'function') {
      date = time.toDate();
    } else if (typeof time.seconds === 'number') {
      date = new Date(time.seconds * 1000);
    } else if (time instanceof Date) {
      date = time;
    } else {
      return 'Completed';
    }
    if (isNaN(date.getTime())) return 'Completed';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Completed';
  }
};

export const formatCleanName = (name: string | undefined | null): string => { if (!name) return ''; return name.replace(/^&\s*/, '').replace(/\s*&$/, '').trim(); };
export const LiveScoreboard: React.FC<{ initialTournamentId?: string, initialCategoryId?: string }> = ({ initialTournamentId, initialCategoryId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming'>('all');
  const [sportFilter, setSportFilter] = useState<'all' | 'padel'>('all');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [isSportFilterOpen, setIsSportFilterOpen] = useState(false);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const dateFilterRef = React.useRef<HTMLDivElement>(null);
  const sportFilterRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) {
        setIsDateFilterOpen(false);
      }
      if (sportFilterRef.current && !sportFilterRef.current.contains(e.target as Node)) {
        setIsSportFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
    setSportFilter('all');
    setIsDateFilterOpen(false);
    setIsSportFilterOpen(false);
  };

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(initialTournamentId || null);
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId || null);
  const [activeArenaTab, setActiveArenaTab] = useState<'live' | 'timelines' | 'standings' | 'results' | 'schedule'>('live');
  const [prevCategory, setPrevCategory] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

  // New Phase 2 Hooks
  const resolvedId = React.useMemo(() => {
    if (!selectedTournamentId) return null;
    if (tournaments.length === 0) return selectedTournamentId;
    const t = tournaments.find(x => x.id === selectedTournamentId || (x.slug && x.slug === selectedTournamentId) || x.name === selectedTournamentId);
    return t ? t.id : selectedTournamentId;
  }, [selectedTournamentId, tournaments]);

  const { tournament: activeTournament, loading: loadingTournament } = useTournamentDoc(resolvedId);
  const { matches: tournamentMatches, loading: loadingMatches } = useTournamentMatches(resolvedId);

  const updateUrl = (tournId: string | null, catId?: string | null) => {
    if (!tournId) {
       window.location.hash = 'live';
    } else {
       // get slug if possible
       const t = tournaments.find(x => x.id === tournId);
       const tId = t?.slug || tournId;
       if (catId) {
           window.location.hash = `live/${tId}/${catId}`;
       } else {
           window.location.hash = `live/${tId}`;
       }
    }
  };

  const handleSelectTournament = (id: string | null) => {
      setSelectedTournamentId(id);
      updateUrl(id, null);
  };

  const handleSelectCategory = (catId: string) => {
      setSelectedCategoryId(catId);
      updateUrl(selectedTournamentId, catId);
  };

  useEffect(() => {
    if (initialTournamentId !== undefined) setSelectedTournamentId(initialTournamentId);
  }, [initialTournamentId]);

  useEffect(() => {
    if (initialCategoryId !== undefined) setSelectedCategoryId(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    const unsubscribe = subscribeToTournaments((data: Tournament[]) => setTournaments(data));
    return () => unsubscribe();
  }, []);



  useEffect(() => {
    if (activeTournament) {
        if (activeTournament?.categories && activeTournament.categories.length > 0 && !selectedCategoryId && !initialCategoryId) {
            const firstCatId = activeTournament.categories[0].id;
            setSelectedCategoryId(firstCatId);
            const tId = activeTournament.slug || activeTournament.id;
            window.location.hash = `live/${tId}/${firstCatId}`;
        }
    }
  }, [activeTournament, selectedCategoryId]);

  useEffect(() => {
    if (activeTournament && tournamentMatches && !loadingMatches) {
        const matchesForCat = (activeTournament.categories && activeTournament.categories.length > 0) && selectedCategoryId
            ? tournamentMatches.filter((m: any) => isMatchInCategory(m, selectedCategoryId, activeTournament))
            : tournamentMatches || [];
        const liveMatchCount = matchesForCat.filter((m: any) => 
            (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE' || String(m.status).toUpperCase() === 'IN_PROGRESS') && 
            !m.winnerTeamId
        ).length;
        
        if (selectedCategoryId !== prevCategory) {
            setPrevCategory(selectedCategoryId);
            if (liveMatchCount === 0) {
                setActiveArenaTab('standings');
            } else {
                setActiveArenaTab('live');
            }
        }
    }
  }, [activeTournament, tournamentMatches, selectedCategoryId, prevCategory, loadingMatches]);

  
  // Broadcast mode is only for running events: a finished tournament (and no
  // match still live) never opens it, even when arriving with it switched on.
  const broadcastEnded = !!activeTournament && !(tournamentMatches || []).some(isMatchLive) && (
      activeTournament.status === 'COMPLETED' || activeTournament.status === 'RETIRED' ||
      (!!activeTournament.endDate && new Date(activeTournament.endDate).getTime() < Date.now()));
  if (isBroadcastMode && activeTournament && !broadcastEnded) {
      return <BroadcastMode tournament={activeTournament} onClose={() => setIsBroadcastMode(false)} />;
  }
  
  return (
    <div className={`spx-root relative min-h-screen ${activeTournament?.broadcastTheme === 'pinktober' ? 'spx-theme-pinktober' : ''}`}>
      {/* Sticky Search & Filter Bar */}
      <div className="spx-bar sticky top-[72px] md:top-[88px] z-40 bg-[#0d0d10]/95 backdrop-blur-2xl border-b border-white/10 py-3.5 px-4 md:px-8 mb-4 shadow-xl transition-all">
          <div className="max-w-7xl mx-auto space-y-2.5">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  {/* Left Column: Context indicator or Back button */}
                  <div className="flex items-center gap-3 shrink-0">
                      {selectedTournamentId && activeTournament ? (
                          <div className="flex items-center gap-2.5">
                              <button 
                                  onClick={() => handleSelectTournament(null)}
                                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                              >
                                  <ChevronLeft size={15} />
                                  <span>Tournaments</span>
                              </button>
                              <span className="text-sm font-black uppercase text-white tracking-wide truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
                                  {activeTournament.name}
                              </span>
                          </div>
                      ) : (
                          <div className="flex items-center gap-2.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
                              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/90">
                                  Live Arena & Tournaments
                              </span>
                              {tournaments.length > 0 && (
                                  <span className="text-[10px] font-mono font-bold bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">
                                      {tournaments.length} Events
                                  </span>
                              )}
                          </div>
                      )}
                  </div>

                  {/* Middle / Right: Search Input + Filters */}
                  <div className="flex items-center gap-2 flex-1 justify-end flex-wrap sm:flex-nowrap">
                      {/* Search Input with Instant Clear Button */}
                      <div className="relative flex-1 min-w-[200px] max-w-md">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                          <input 
                              ref={searchInputRef}
                              type="text" 
                              placeholder={selectedTournamentId ? "Search matches, teams, courts, players..." : "Search tournaments, clubs, cities, players..."}
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              className="w-full bg-[#18181b]/80 border border-white/15 rounded-full py-2 pl-10 pr-9 text-white text-xs sm:text-sm font-medium tracking-wide focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all placeholder:text-zinc-500"
                          />
                          {searchQuery && (
                              <button
                                  onClick={() => {
                                      setSearchQuery('');
                                      searchInputRef.current?.focus();
                                  }}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Clear search"
                              >
                                  <X size={14} />
                              </button>
                          )}
                      </div>

                      {/* Dropdown Filters (Only relevant on tournament list overview) */}
                      {!selectedTournamentId && (
                          <div className="flex items-center gap-2 shrink-0">
                              {/* Date Filter Dropdown */}
                              <div ref={dateFilterRef} className="relative">
                                  <button
                                      onClick={() => {
                                          setIsDateFilterOpen(v => !v);
                                          setIsSportFilterOpen(false);
                                      }}
                                      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer ${
                                          dateFilter !== 'all'
                                              ? 'bg-brand text-black border-brand font-black shadow-sm'
                                              : 'bg-[#18181b] hover:bg-white/10 text-zinc-300 hover:text-white border-white/15'
                                      }`}
                                      title="Filter by date"
                                  >
                                      <Calendar size={13} className={dateFilter !== 'all' ? 'text-black' : 'text-zinc-400'} />
                                      <span>{dateFilter === 'all' ? 'Dates' : dateFilter === 'today' ? 'Today' : 'Upcoming'}</span>
                                      <ChevronDown size={13} className={`transition-transform duration-200 ${isDateFilterOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                  <AnimatePresence>
                                      {isDateFilterOpen && (
                                          <motion.div
                                              initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                              animate={{ opacity: 1, y: 0, scale: 1 }}
                                              exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                              transition={{ duration: 0.12 }}
                                              className="absolute right-0 top-full mt-2 min-w-[160px] bg-[#18181b]/98 backdrop-blur-2xl border border-white/20 rounded-2xl p-1.5 shadow-2xl z-50 flex flex-col gap-1"
                                          >
                                              <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-white/10 mb-0.5">
                                                  Date Range
                                              </div>
                                              <button
                                                  onClick={() => { setDateFilter('all'); setIsDateFilterOpen(false); }}
                                                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                                      dateFilter === 'all' ? 'bg-brand text-black font-black' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                                                  }`}
                                              >
                                                  <span>All Dates</span>
                                                  {dateFilter === 'all' && <Check size={14} className="stroke-[3]" />}
                                              </button>
                                              <button
                                                  onClick={() => { setDateFilter('today'); setIsDateFilterOpen(false); }}
                                                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                                      dateFilter === 'today' ? 'bg-brand text-black font-black' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                                                  }`}
                                              >
                                                  <div className="flex items-center gap-1.5">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                      <span>Today</span>
                                                  </div>
                                                  {dateFilter === 'today' && <Check size={14} className="stroke-[3]" />}
                                              </button>
                                              <button
                                                  onClick={() => { setDateFilter('upcoming'); setIsDateFilterOpen(false); }}
                                                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                                      dateFilter === 'upcoming' ? 'bg-brand text-black font-black' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                                                  }`}
                                              >
                                                  <span>Upcoming</span>
                                                  {dateFilter === 'upcoming' && <Check size={14} className="stroke-[3]" />}
                                              </button>
                                          </motion.div>
                                      )}
                                  </AnimatePresence>
                              </div>

                              {/* Sport Filter Dropdown */}
                              <div ref={sportFilterRef} className="relative">
                                  <button
                                      onClick={() => {
                                          setIsSportFilterOpen(v => !v);
                                          setIsDateFilterOpen(false);
                                      }}
                                      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer ${
                                          sportFilter !== 'all'
                                              ? 'bg-emerald-400 text-black border-emerald-400 font-black shadow-sm'
                                              : 'bg-[#18181b] hover:bg-white/10 text-zinc-300 hover:text-white border-white/15'
                                      }`}
                                      title="Filter by sport"
                                  >
                                      <Activity size={13} className={sportFilter !== 'all' ? 'text-black' : 'text-emerald-400'} />
                                      <span>{sportFilter === 'all' ? 'Sports' : 'Padel'}</span>
                                      <ChevronDown size={13} className={`transition-transform duration-200 ${isSportFilterOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                  <AnimatePresence>
                                      {isSportFilterOpen && (
                                          <motion.div
                                              initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                              animate={{ opacity: 1, y: 0, scale: 1 }}
                                              exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                              transition={{ duration: 0.12 }}
                                              className="absolute right-0 top-full mt-2 min-w-[160px] bg-[#18181b]/98 backdrop-blur-2xl border border-white/20 rounded-2xl p-1.5 shadow-2xl z-50 flex flex-col gap-1"
                                          >
                                              <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-white/10 mb-0.5">
                                                  Sport
                                              </div>
                                              <button
                                                  onClick={() => { setSportFilter('all'); setIsSportFilterOpen(false); }}
                                                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                                      sportFilter === 'all' ? 'bg-emerald-400 text-black font-black' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                                                  }`}
                                              >
                                                  <span>All Sports</span>
                                                  {sportFilter === 'all' && <Check size={14} className="stroke-[3]" />}
                                              </button>
                                              <button
                                                  onClick={() => { setSportFilter('padel'); setIsSportFilterOpen(false); }}
                                                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                                      sportFilter === 'padel' ? 'bg-emerald-400 text-black font-black' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                                                  }`}
                                              >
                                                  <span>Padel</span>
                                                  {sportFilter === 'padel' && <Check size={14} className="stroke-[3]" />}
                                              </button>
                                          </motion.div>
                                      )}
                                  </AnimatePresence>
                              </div>
                          </div>
                      )}

                      {/* Reset All Filters Button */}
                      {(searchQuery || (!selectedTournamentId && (dateFilter !== 'all' || sportFilter !== 'all'))) && (
                          <button
                              onClick={handleResetAllFilters}
                              className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 transition-all cursor-pointer uppercase tracking-wider shrink-0"
                              title="Reset all search filters"
                          >
                              <X size={13} />
                              <span>Reset</span>
                          </button>
                      )}
                  </div>
              </div>

              {/* Active Filter Chips */}
              {(searchQuery || (!selectedTournamentId && (dateFilter !== 'all' || sportFilter !== 'all'))) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5 text-xs">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Active Filters:</span>
                      {searchQuery && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white text-[11px] font-medium">
                              <span>"{searchQuery}"</span>
                              <button onClick={() => setSearchQuery('')} className="hover:text-amber-400 cursor-pointer ml-0.5">
                                  <X size={11} />
                              </button>
                          </span>
                      )}
                      {!selectedTournamentId && dateFilter !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand/20 border border-brand/40 text-brand text-[11px] font-bold uppercase">
                              <span>Date: {dateFilter}</span>
                              <button onClick={() => setDateFilter('all')} className="hover:text-white cursor-pointer ml-0.5">
                                  <X size={11} />
                              </button>
                          </span>
                      )}
                      {!selectedTournamentId && sportFilter !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold uppercase">
                              <span>Sport: {sportFilter}</span>
                              <button onClick={() => setSportFilter('all')} className="hover:text-white cursor-pointer ml-0.5">
                                  <X size={11} />
                              </button>
                          </span>
                      )}
                  </div>
              )}
          </div>
      </div>

      {!selectedTournamentId ? (
          <TournamentList 
            tournaments={tournaments} 
            onSelect={handleSelectTournament} 
            searchQuery={searchQuery} 
            dateFilter={dateFilter} 
            sportFilter={sportFilter} 
            onResetFilters={handleResetAllFilters}
          />
      ) : loadingTournament ? (
          <div className="text-center p-10 text-gray-500">Loading...</div>
      ) : !activeTournament ? (
          <div className="text-center p-10 text-gray-400">Tournament not found</div>
      ) : (
          <TournamentDetail
            tournament={activeTournament}
            matches={tournamentMatches}
            onBack={() => handleSelectTournament(null)}
            onEnterBroadcastMode={() => setIsBroadcastMode(true)}
            searchQuery={searchQuery}
          />
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

const BroadcastOverlay = ({ event }: { event: any }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!event) {
            setVisible(false);
            return;
        }

        const now = Date.now();
        const timeSince = now - event.timestamp;
        if (timeSince < event.duration) {
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), event.duration - timeSince);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [event]);

    if (!visible || !event) return null;

    if (event.type === 'TOMBSTONE') {
        return (
            <div className="absolute bottom-0 left-1/2 z-50 animate-slide-up w-full px-4 md:w-auto md:px-0">
                <div className="bg-gradient-to-t from-black to-surface-ground text-white px-6 py-4 md:px-12 rounded-t-xl border-t-4 border-brand shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center min-w-full md:min-w-[300px]">
                    <div className="text-brand font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-1">UPDATE</div>
                    <div className="text-2xl md:text-4xl font-black italic tracking-[0.15em]er uppercase text-center">{event.message}</div>
                    {event.subMessage && <div className="text-content-muted font-bold uppercase tracking-widest text-xs md:text-sm mt-1 text-center">{event.subMessage}</div>}
                </div>
            </div>
        );
    }

    if (event.type === 'VIOLATOR') {
        return (
            <div className="absolute top-20 right-0 z-50 animate-slide-in-right max-w-[90%] md:max-w-none">
                <div className="bg-brand text-content-inverse pl-6 pr-12 py-4 md:pl-8 md:pr-20 md:py-6 rounded-l-full shadow-[0_10px_40px_rgba(180,252,87,0.4)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 md:w-32 h-full bg-black/10 skew-x-12 translate-x-10 md:translate-x-16"></div>
                    <div className="relative z-10">
                        <div className="font-black uppercase tracking-[0.2em] text-[10px] md:text-xs text-content-inverse/70 mb-1">ATTENTION</div>
                        <div className="text-xl md:text-3xl font-black italic tracking-[0.15em]er uppercase">{event.message}</div>
                        {event.subMessage && <div className="text-content-inverse/80 font-bold uppercase tracking-widest text-[10px] md:text-xs mt-1">{event.subMessage}</div>}
                    </div>
                </div>
            </div>
        );
    }

    if (event.type === 'MASCOT_HAPPY' || event.type === 'MASCOT_SAD') {
        const isHappy = event.type === 'MASCOT_HAPPY';
        return (
            <div className="absolute top-20 right-0 z-50 animate-slide-in-right max-w-[90%] md:max-w-none">
                <div className={`pl-4 pr-12 py-4 md:pl-6 md:pr-20 md:py-6 rounded-l-full shadow-2xl relative overflow-hidden flex items-center gap-4 md:gap-6 ${isHappy ? 'bg-[#b4fc57] text-[#0A0A0A]' : 'bg-[#1A1A1A] text-white border-y border-l border-white/20'}`}>
                    <div className="absolute top-0 right-0 w-32 h-full bg-black/10 skew-x-12 translate-x-16"></div>
                    
                    {/* Futuristic Mascot UI Component */}
                    <div className="relative z-10 bg-[#0A0A0A] shadow-inner rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center shrink-0 border-[3px] md:border-4 border-white/20 overflow-hidden box-content">
                        <div className="flex flex-col items-center justify-center w-full h-full bg-[#111111]">
                           <div className={`w-10 h-10 md:w-12 md:h-12 rounded-[30%] flex flex-col items-center justify-center transition-all border-2 border-black/50 shadow-inner ${isHappy ? 'bg-[#b4fc57]' : 'bg-[#E65C31]'}`}>
                               <div className="flex gap-2">
                                   <div className={`w-2 h-2 md:w-2.5 md:h-2.5 bg-black rounded-full ${isHappy ? '' : 'skew-x-12'}`}></div>
                                   <div className={`w-2 h-2 md:w-2.5 md:h-2.5 bg-black rounded-full ${isHappy ? '' : '-skew-x-12'}`}></div>
                               </div>
                               {isHappy ? (
                                   <div className="w-5 h-2.5 border-b-[3px] border-black rounded-b-full mt-1.5"></div>
                               ) : (
                                   <div className="w-5 h-2 border-t-[3px] border-black rounded-t-full mt-1.5 translate-y-0.5"></div>
                               )}
                           </div>
                        </div>
                    </div>
                    
                    <div className="relative z-10 pr-2">
                        <div className={`font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-1 ${isHappy ? 'text-black/50' : 'text-white/50'}`}>{isHappy ? 'SPECTACULAR!' : 'UNFORCED ERROR'}</div>
                        <div className={`text-xl md:text-3xl font-black italic tracking-[0.15em]er uppercase ${isHappy ? 'text-[#0A0A0A]' : 'text-white'}`}>{event.message}</div>
                        {event.subMessage && <div className={`font-bold uppercase tracking-widest text-[10px] md:text-xs mt-1 ${isHappy ? 'text-black/70' : 'text-[#E65C31]'}`}>{event.subMessage}</div>}
                    </div>
                </div>
            </div>
        );
    }

    if (event.type === 'SCORE_UPDATE') {
        // Subtle flash or specific animation handled in LiveCard, but we can add a global effect here if needed
        return null; 
    }

    return null;
};

const TournamentList = ({ tournaments, onSelect, searchQuery = '', dateFilter = 'all', sportFilter = 'all', onResetFilters }: any) => {
    const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'live' | 'ongoing' | 'upcoming' | 'completed'>('all');
    const [liveMatchTournamentIds, setLiveMatchTournamentIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        try {
            
            const q = query(collectionGroup(db, 'matches'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const liveIds = new Set<string>();
                snapshot.docs.forEach((doc) => {
                    const matchData = doc.data();
                    if (matchData.status === 'IN_PROGRESS' || matchData.status === 'LIVE') {
                        const pathParts = doc.ref.path.split('/');
                        if (pathParts.length >= 2 && pathParts[0] === 'tournaments') {
                            liveIds.add(pathParts[1]);
                        }
                    }
                });
                setLiveMatchTournamentIds(liveIds);
            }, (error) => {
                console.error("Error subscribing to matches collection group:", error);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase not initialized or error setting up matches listener:", e);
        }
    }, []);

    const categorizeTournament = (t: Tournament) => {
        const now = new Date();
        if (t.status === 'COMPLETED' || t.status === 'RETIRED' || (t.endDate && new Date(t.endDate) < now)) {
            return 'completed';
        }
        const hasLiveMatchRealtime = liveMatchTournamentIds.has(t.id);
        const hasLiveMatch = hasLiveMatchRealtime || t.matches?.some(m => m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE' || String(m.status).toUpperCase() === 'IN_PROGRESS');
        if (t.status === 'ACTIVE' && hasLiveMatch) {
            return 'live';
        }
        if (t.status === 'ACTIVE' && t.startDate && new Date(t.startDate) <= now) {
            return 'ongoing';
        }
        return 'upcoming';
    };

    // Filter tournaments based on search query, date filter, and sport filter
    const filteredTournaments = React.useMemo(() => {
        let result = [...tournaments];

        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(t => {
                const nameMatch = (t.name || '').toLowerCase().includes(q);
                const clubMatch = (t.clubName || '').toLowerCase().includes(q);
                const cityMatch = (t.city || '').toLowerCase().includes(q) || (t.location || '').toLowerCase().includes(q);
                const venueMatch = (t.venue || '').toLowerCase().includes(q);
                const descMatch = (t.description || '').toLowerCase().includes(q);
                const teamMatch = t.teams?.some((team: any) => 
                    (team.name || '').toLowerCase().includes(q) || 
                    (team.player1?.name || '').toLowerCase().includes(q) || 
                    (team.player2?.name || '').toLowerCase().includes(q) || 
                    team.players?.some((p: any) => (p.name || p.fullName || '')?.toLowerCase().includes(q))
                );
                return nameMatch || clubMatch || cityMatch || venueMatch || descMatch || teamMatch;
            });
        }

        if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const todayEnd = todayStart + 24 * 60 * 60 * 1000;

            result = result.filter(t => {
                const start = t.startDate ? new Date(t.startDate).getTime() : 0;
                const end = t.endDate ? new Date(t.endDate).getTime() : start;
                if (dateFilter === 'today') {
                    return (start <= todayEnd && end >= todayStart);
                }
                if (dateFilter === 'upcoming') {
                    return start > todayEnd;
                }
                return true;
            });
        }

        if (sportFilter && sportFilter !== 'all') {
            result = result.filter(t => {
                if (sportFilter === 'padel') {
                    return !t.sport || t.sport.toLowerCase() === 'padel';
                }
                return t.sport?.toLowerCase() === sportFilter.toLowerCase();
            });
        }

        return result;
    }, [tournaments, searchQuery, dateFilter, sportFilter]);

    const categorized = React.useMemo(() => {
        const live: Tournament[] = [];
        const ongoing: Tournament[] = [];
        const upcoming: Tournament[] = [];
        const completed: Tournament[] = [];

        filteredTournaments.forEach((t: Tournament) => {
            const cat = categorizeTournament(t);
            if (cat === 'live') live.push(t);
            else if (cat === 'ongoing') ongoing.push(t);
            else if (cat === 'upcoming') upcoming.push(t);
            else completed.push(t);
        });

        // Most-recently-started first, since that's the one most likely to
        // still have rounds left to play.
        ongoing.sort((a, b) => {
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        });

        upcoming.sort((a, b) => {
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });

        completed.sort((a, b) => {
            if (!a.endDate) return 1;
            if (!b.endDate) return -1;
            return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
        });

        return { live, ongoing, upcoming, completed };
    }, [filteredTournaments, liveMatchTournamentIds]);

    const featuredTournament = React.useMemo(() => {
        return categorized.live[0] || categorized.ongoing[0] || categorized.upcoming[0] || categorized.completed[0] || null;
    }, [categorized]);

    const formatMonthYear = (dateStr?: string) => {
        if (!dateStr) return 'this season';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'this season';
            return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } catch (e) {
            return 'this season';
        }
    };

    const tabs: any[] = [
        { id: 'all', label: 'All Tournaments' },
        { id: 'live', label: 'Live Now', count: categorized.live.length, isLive: true },
        { id: 'ongoing', label: 'Ongoing', count: categorized.ongoing.length },
        { id: 'upcoming', label: 'Upcoming', count: categorized.upcoming.length },
        { id: 'completed', label: 'Completed', count: categorized.completed.length }
    ];

    return (
        <div className="min-h-screen pt-20 md:pt-28 pb-24 px-4 md:px-8 max-w-7xl mx-auto w-full">
            {/* Cinematic Billboard (Hero Section) */}
            {activeCategoryTab === 'all' && !searchQuery && featuredTournament && (
                <div 
                    className="spx-billboard relative w-full h-[60vh] md:h-[72vh] flex items-end justify-start overflow-hidden rounded-[32px] mb-14"
                >
                    {/* Background Banner */}
                    <div className="absolute inset-0">
                        {featuredTournament.bannerUrl ? (
                            <img 
                                src={featuredTournament.bannerUrl} 
                                alt={featuredTournament.name}
                                className="w-full h-full object-cover object-center scale-102"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="spx-hero__art"><span className="spx-hero__art-court" /></div>
                        )}
                        <div className="spx-hero__shade" />
                    </div>

                    {/* Billboard Content */}
                    <div className="relative z-10 p-6 md:p-12 max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="flex items-center gap-3">
                            <span className="bg-[#4D78FF] text-white font-black text-[9px] tracking-[0.25em] uppercase px-3 py-1 rounded-md shadow-lg flex items-center gap-1.5 font-mono">
                                {categorizeTournament(featuredTournament) === 'live' ? (
                                    <>
                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping shrink-0" />
                                        Featured Live Now
                                    </>
                                ) : (
                                    'Featured Tournament'
                                )}
                            </span>
                            <span className="text-white/60 font-black text-[9px] tracking-widest uppercase font-mono">
                                {featuredTournament.venue || 'Global Arena'}
                            </span>
                        </div>

                        <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tight leading-none drop-shadow-lg">
                            {featuredTournament.name}
                        </h1>

                        <p className="text-gray-300 text-sm md:text-base font-normal max-w-lg leading-relaxed drop-shadow-md">
                            {(featuredTournament as any).description || 
                                `Experience the ultimate padel clash at ${featuredTournament.venue || 'Global Arena'}. ${(featuredTournament.teams || []).length} elite teams battle for the crown starting ${formatMonthYear(featuredTournament.startDate)}.`}
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <button 
                                onClick={() => onSelect(featuredTournament.id)}
                                className="spx-btn spx-btn--primary"
                            >
                                <Play size={14} fill="currentColor" />
                                <span>Watch Live Arena</span>
                            </button>
                            <a 
                                href={`#register/${featuredTournament.slug || featuredTournament.id}`}
                                className="spx-btn spx-btn--ghost"
                            >
                                <Info size={14} />
                                <span>Tournament Details</span>
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Spectator Header (Fallback / When category is filtered) */}
            {(activeCategoryTab !== 'all' || !featuredTournament) && (
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h1 className="text-4xl md:text-5xl font-display text-white tracking-tight uppercase mb-4 font-black">
                        Spectator Arena
                    </h1>
                    <p className="text-gray-400 text-xs md:text-sm font-bold tracking-widest uppercase">
                        Select a tournament below to watch live courts, results, and standings
                    </p>
                </div>
            )}

            {/* Filter Navigation */}
            <div className="flex justify-start md:justify-center overflow-x-auto scrollbar-none pb-4 mb-12 w-full">
                <div className="flex bg-[#1B1B1E] p-1.5 rounded-full border border-white/5 gap-1.5 shrink-0 shadow-2xl">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveCategoryTab(tab.id)}
                            className={`px-5 py-2.5 rounded-full font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 relative cursor-pointer border-none ${
                                activeCategoryTab === tab.id
                                    ? 'bg-[#4D78FF] text-white shadow-lg shadow-[#4D78FF]/20'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab.isLive && (
                                <span className={`w-1.5 h-1.5 rounded-full ${activeCategoryTab === tab.id ? 'bg-white animate-pulse' : 'bg-[#4D78FF] animate-ping'}`} />
                            )}
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black font-mono ${
                                    activeCategoryTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Redesigned Rows / Grid Container */}
            <div className="space-y-16">
                {(activeCategoryTab === 'all' || activeCategoryTab === 'live') && categorized.live.length > 0 && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="h-2.5 w-2.5 bg-[#4D78FF] rounded-full animate-pulse shadow-glow" />
                            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white">Live Matches Now</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {categorized.live.map((t: Tournament) => (
                                <TournamentBannerCard
                                    key={t.id}
                                    tournament={t}
                                    variant="live"
                                    onClick={() => onSelect(t.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {(activeCategoryTab === 'all' || activeCategoryTab === 'ongoing') && categorized.ongoing.length > 0 && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="h-2.5 w-2.5 bg-[#E65C31] rounded-full" />
                            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white">Ongoing Tournaments</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {categorized.ongoing.map((t: Tournament) => (
                                <TournamentBannerCard
                                    key={t.id}
                                    tournament={t}
                                    variant="ongoing"
                                    onClick={() => onSelect(t.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {(activeCategoryTab === 'all' || activeCategoryTab === 'upcoming') && categorized.upcoming.length > 0 && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 mb-6">
                            <Calendar size={18} className="text-[#4D78FF]" />
                            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white">Trending Events</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {categorized.upcoming.map((t: Tournament) => (
                                <TournamentBannerCard
                                    key={t.id}
                                    tournament={t}
                                    variant="upcoming"
                                    onClick={() => onSelect(t.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {(activeCategoryTab === 'all' || activeCategoryTab === 'completed') && categorized.completed.length > 0 && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 mb-6">
                            <Trophy size={18} className="text-accent-success" />
                            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white">Previous tournaments</h2>
                        </div>
                        <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 scrollbar-none w-full">
                            {categorized.completed.map((t: Tournament) => (
                                <div key={t.id} className="shrink-0 w-[290px] sm:w-[350px] snap-center">
                                    <TournamentBannerCard
                                        tournament={t}
                                        variant="completed"
                                        onClick={() => onSelect(t.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {filteredTournaments.length === 0 ? (
                    <div className="text-center py-20 bg-[#1B1B1E]/40 rounded-3xl border border-white/5 border-dashed max-w-md mx-auto my-8 p-6">
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mx-auto mb-3">
                            <Search size={20} />
                        </div>
                        <p className="text-white font-black uppercase tracking-wider text-base mb-1">No Tournaments Match</p>
                        <p className="text-gray-400 text-xs mb-5">Try checking your spelling or adjusting your date and sport filters.</p>
                        {onResetFilters && (
                            <button
                                onClick={onResetFilters}
                                className="px-5 py-2 rounded-full bg-brand text-black font-black text-xs uppercase tracking-wider hover:bg-brand-light transition-all cursor-pointer shadow-lg"
                            >
                                Reset Search & Filters
                            </button>
                        )}
                    </div>
                ) : activeCategoryTab !== 'all' && categorized[activeCategoryTab].length === 0 && (
                    <div className="text-center py-24 bg-[#1B1B1E]/40 rounded-3xl border border-white/5 border-dashed max-w-md mx-auto">
                        <p className="text-white font-black uppercase italic tracking-widest text-base mb-2">No Tournaments Found</p>
                        <p className="text-gray-400 text-xs">There are no tournaments in the "{activeCategoryTab}" list right now.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const LiveCard = ({ match: initialMatch, teams, sponsors, tournament }: any) => {
    // Phase 1 Real-time pattern: Subscribe to single global match doc
    const { matchData } = useMatchResult(initialMatch.id);
    const match = matchData || initialMatch;

    const t1 = teams.find((t: any) => t.id === match.team1Id);
    const t2 = teams.find((t: any) => t.id === match.team2Id);

    // Pick a random premium sponsor to display on this card if available
    const featuredSponsor = sponsors && sponsors.length > 0 ? sponsors[Math.floor(Math.random() * sponsors.length)] : null;

    const [displayScore, setDisplayScore] = useState(match.score);
    const [flashOverlayTitle, setFlashOverlayTitle] = useState<string | null>(null);
    const [flashOverlaySubtitle, setFlashOverlaySubtitle] = useState<string | null>(null);
    const [lastHistoryLength, setLastHistoryLength] = useState(0);

    const effectiveHistory = getEffectiveEvents(match.score?.history || []);

    useEffect(() => {
        const isFinished = (match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') || String(match.status).toUpperCase() === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED';
        if (isFinished) {
            setDisplayScore(match.score);
            return;
        }
        
        if (effectiveHistory.length > lastHistoryLength && lastHistoryLength > 0) {
            // New point added!
            const ev = effectiveHistory[effectiveHistory.length - 1];
            if (ev && (ev.startsWith('T1') || ev.startsWith('T2'))) {
                const parts = ev.split('|');
                const type = parts[0];
                const playerIdx = parseInt(parts[2] || "1");
                const tag = parts[3];
                const finisher = parts[4];
                
                const team = type === 'T1' ? t1 : t2;
                const player = playerIdx === 1 ? team?.player1?.name : team?.player2?.name;
                const teamName = team?.name || type;
                let actionStr = "POINT WON";
                if (finisher === 'smash') actionStr = "SMASH WINNER";
                else if (finisher === 'vibora') actionStr = "VIBORA WINNER";
                else if (finisher === 'drop' || finisher === 'drop shot') actionStr = "DROP SHOT WINNER";
                else if (finisher === 'bandeja') actionStr = "BANDEJA WINNER";
                else if (finisher === 'volley') actionStr = "VOLLEY WINNER";
                else if (finisher === 'net') actionStr = "NET ERROR";
                else if (finisher === 'glass') actionStr = "GLASS ERROR";
                else if (finisher === 'double fault') actionStr = "DOUBLE FAULT";
                else if (finisher === 'grill') actionStr = "GRILL ERROR";
                else if (tag === 'winner') actionStr = "WINNER";
                else if (tag === 'error') actionStr = "UNFORCED ERROR";
                
                setFlashOverlayTitle(actionStr);
                setFlashOverlaySubtitle(player || teamName);
                
                setTimeout(() => {
                    setFlashOverlayTitle(null);
                    setDisplayScore(match.score);
                }, 2000);
            } else {
                setDisplayScore(match.score);
            }
        } else {
            // Init or undo
            setDisplayScore(match.score);
        }
        setLastHistoryLength(effectiveHistory.length);
    }, [match.score, effectiveHistory.length]);

    const defaultScore = {
        p1Points: "0",
        p2Points: "0",
        p1Games: 0,
        p2Games: 0,
        p1Sets: 0,
        p2Sets: 0,
        p1SetScores: [] as number[],
        p2SetScores: [] as number[],
        currentSet: 1,
        isTiebreak: false,
        history: [] as string[],
        server: null,
        goldenPoint: false,
        _isSuperTiebreak: false,
    };
    const activeScore = displayScore || match.score || defaultScore;

    // Score Update Animation
    const [scoreFlash, setScoreFlash] = useState(false);
    useEffect(() => {
        if (match.activeBroadcastEvent?.type === 'SCORE_UPDATE') {
            const now = Date.now();
            if (now - match.activeBroadcastEvent.timestamp < 2000) {
                setScoreFlash(true);
                const t = setTimeout(() => setScoreFlash(false), 2000);
                return () => clearTimeout(t);
            }
        }
    }, [match.activeBroadcastEvent]);

    const isT1Serving = activeScore?.server === 'p1' || activeScore?.server === 'p2';
    const isT2Serving = activeScore?.server === 'p3' || activeScore?.server === 'p4';
    const isTiebreak = activeScore?.isTiebreak;
    const isSuperTiebreak = activeScore?._isSuperTiebreak;
    const isStarPoint = activeScore?.goldenPoint;

    const recentEvents = effectiveHistory
        .filter((ev: string) => ev.startsWith('T1') || ev.startsWith('T2'))
        .slice(-3)
        .reverse()
        .map((ev: string) => {
            const parts = ev.split('|');
            const type = parts[0];
            const playerIdx = parseInt(parts[2] || "1");
            const tag = parts[3];
            const finisher = parts[4];
            
            const team = type === 'T1' ? t1 : t2;
            const player = playerIdx === 1 ? team?.player1?.name : team?.player2?.name;
            const teamName = team?.name || type;
            let actionStr = "Point Won";
            if (finisher === 'smash') actionStr = "SMASH WINNER";
            else if (finisher === 'vibora') actionStr = "VIBORA WINNER";
            else if (finisher === 'drop' || finisher === 'drop shot') actionStr = "DROP SHOT WINNER";
            else if (finisher === 'bandeja') actionStr = "BANDEJA WINNER";
            else if (finisher === 'volley') actionStr = "VOLLEY WINNER";
            else if (finisher === 'net') actionStr = "NET ERROR";
            else if (finisher === 'glass') actionStr = "GLASS ERROR";
            else if (finisher === 'double fault') actionStr = "DOUBLE FAULT";
            else if (finisher === 'grill') actionStr = "GRILL ERROR";
            else if (tag === 'winner') actionStr = "WINNER";
            else if (tag === 'error') actionStr = "UNFORCED ERROR";
            
            return `${player || teamName} - ${actionStr}`;
        });

    // Determine state priority: Star Point > Super Tiebreak > Tiebreak > Normal
    const state = isStarPoint ? 'STAR_POINT' : isSuperTiebreak ? 'SUPER_TIEBREAK' : isTiebreak ? 'TIEBREAK' : 'NORMAL';

    let cardClasses = "";
    let glowClasses = "";
    let svgStrokes = "";
    let statusText = (match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') ? 'COMPLETED' : match.roundName || 'FINAL';
    let uiColor = { primary: '#00E5FF', bg: '#0D1520', stroke: 'rgba(0,229,255,' };
    
    switch (state) {
        case 'STAR_POINT':
            cardClasses = "bg-gradient-to-br from-[#1F1705] to-[#2B2005] border-[1.5px] border-[#FBBF24]/60 animate-[starPointShimmer_2s_linear_infinite]";
            glowClasses = "bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.3)_0%,transparent_65%)] animate-[glowPulseFast_1s_ease-in-out_infinite]";
            svgStrokes = "rgba(251,191,36,";
            statusText = "★ STAR POINT";
            uiColor = { primary: '#FBBF24', bg: '#1F1705', stroke: 'rgba(251,191,36,' };
            break;
        case 'SUPER_TIEBREAK':
            cardClasses = "bg-gradient-to-br from-[#1F0A0A] to-[#2B0A0A] border-[1.5px] border-[#EF4444]/60 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]";
            glowClasses = "bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.3)_0%,transparent_65%)] animate-[superPulse_0.8s_ease-in-out_infinite]";
            svgStrokes = "rgba(239,68,68,";
            statusText = "SUPER TIEBREAK";
            uiColor = { primary: '#EF4444', bg: '#1F0A0A', stroke: 'rgba(239,68,68,' };
            break;
        case 'TIEBREAK':
            // Brand color is orange #E65C31
            cardClasses = "bg-[#1A0A05] border border-[#E65C31]/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(230,92,49,0.03)_10px,rgba(230,92,49,0.03)_20px)] animate-[panBackground_20s_linear_infinite]";
            glowClasses = "bg-[radial-gradient(ellipse_at_center,rgba(230,92,49,0.25)_0%,transparent_65%)] animate-[glowPulse_1.5s_ease-in-out_infinite]";
            svgStrokes = "rgba(230,92,49,";
            statusText = "TIEBREAK";
            uiColor = { primary: '#E65C31', bg: '#1A0A05', stroke: 'rgba(230,92,49,' };
            break;
        default:
            cardClasses = "bg-[#0D1520] border-white/[0.07]";
            glowClasses = "bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.15)_0%,transparent_65%)] animate-[glowPulse_3s_ease-in-out_infinite]";
            svgStrokes = "rgba(0,229,255,";
            uiColor = { primary: '#00E5FF', bg: '#0D1520', stroke: 'rgba(0,229,255,' };
            break;
    }

    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const t1P1Name = getFirstName(t1?.player1?.name);
    const t1P2Name = getFirstName(t1?.player2?.name);
    const t2P1Name = getFirstName(t2?.player1?.name);
    const t2P2Name = getFirstName(t2?.player2?.name);

    const t1DisplayName = formatCleanName(t1?.name || match.team1Name || [ t1P1Name, t1P2Name ].filter(n => n && n.trim()).join(' & ') || 'TBA') || 'TBA';
    const t2DisplayName = formatCleanName(t2?.name || match.team2Name || [ t2P1Name, t2P2Name ].filter(n => n && n.trim()).join(' & ') || 'TBA') || 'TBA';

    return (
        <div className={`w-full max-w-[520px] mx-auto rounded-[16px] overflow-hidden relative p-[24px_24px_24px_26px] font-sans group transition-all duration-300 ${cardClasses} ${scoreFlash ? 'scale-[1.02]' : ''}`}>
            
            <AnimatePresence>
                {scoreFlash && !flashOverlayTitle && (
                    <motion.div 
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="absolute inset-x-0 top-[40%] z-40 flex justify-center pointer-events-none"
                    >
                        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-1.5 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.4)] border border-cyan-300/50 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="text-white font-black uppercase tracking-widest text-xs drop-shadow-md">Point Won</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {flashOverlayTitle && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none p-4 bg-black/80 backdrop-blur-sm">
                    <span className="font-black text-white italic text-2xl z-10 text-center leading-tight">
                        {flashOverlayTitle}
                    </span>
                </div>
            )}
        </div>
    );
};

export const MatchTimeline = ({ matches, teams }: { matches: any[]; teams: any[] }) => {
    const [selectedCourt, setSelectedCourt] = useState<string>('ALL');

    const courts = Array.from(new Set(matches.map(m => m.court)));

    const filteredMatches = selectedCourt === 'ALL' ? matches : matches.filter(m => m.court === selectedCourt);

    const allHistory: any[] = [];
    filteredMatches.forEach(m => {
        if (m.score?.history) {
            const effectiveSet = new Set(getEffectiveEvents(m.score.history));
            const startTimeEvent = m.score.history.find(e => e.includes('|'));
            const startTime = startTimeEvent ? parseInt(startTimeEvent.split('|')[1] || "0") : 0;
            const t1 = teams.find(t => t.id === m.team1Id);
            const t2 = teams.find(t => t.id === m.team2Id);

            m.score.history.forEach((ev, idx) => {
                const parts = ev.split('|');
                const type = parts[0];
                const ts = parseInt(parts[1] || "0");
                const playerIdx = parseInt(parts[2] || "1");
                const tag = parts[3];
                const finisher = parts[4]; // NEW

                if (type === 'UNDO' || type === 'REMOVE') return;

                let message = "";
                let teamName = "";
                const isUndone = !effectiveSet.has(ev);

                if (type === 'START_SET_NORMAL' || type === 'START_SET_SUPER') {
                    message = `Set begins`;
                } else if (type === 'T1' || type === 'T2') {
                    const team = type === 'T1' ? t1 : t2;
                    const player = playerIdx === 1 ? team?.player1?.name : team?.player2?.name;
                    teamName = team?.name || type;
                    let actionStr = "Point won";
                    if (finisher === 'smash') {
                        actionStr = "Smashed";
                    } else if (tag === 'winner') {
                        actionStr = "Winner";
                    } else if (tag === 'error') {
                        actionStr = "Unforced error";
                    }
                    message = `${actionStr} by ${player || teamName}`;
                } else {
                    return;
                }

                allHistory.push({
                    id: `${m.id}-${idx}-${ts}`,
                    ts,
                    startTime,
                    court: m.court,
                    message,
                    isUndone,
                    type,
                    tag
                });
            });
        }
    });

    allHistory.sort((a, b) => b.ts - a.ts);

    const formatTime = (ts: number, startTime: number) => {
        if (!startTime || !ts) return "00:00";
        let diff = Math.floor((ts - startTime) / 1000);
        if (diff < 0) diff = 0;
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white tracking-[0.15em]">Action Log</h3>
                {courts.length > 1 && (
                    <div className="relative w-40">
                        <select 
                            value={selectedCourt}
                            onChange={(e) => setSelectedCourt(e.target.value)}
                            className="w-full appearance-none bg-[#111111] border border-white/10 text-white text-[10px] md:text-xs font-black uppercase tracking-wider py-2 pl-4 pr-10 rounded-xl outline-none focus:border-[#4D78FF] cursor-pointer"
                        >
                            <option value="ALL">All Courts</option>
                            {courts.map((c, i) => (
                                <option key={i} value={c}>{c}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                    </div>
                )}
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                {allHistory.length === 0 ? (
                    <div className="text-center text-[#9CA3AF] py-10 font-bold uppercase tracking-widest text-xs">No events recorded yet.</div>
                ) : (
                    allHistory.map(item => (
                        <div key={item.id} className={`flex items-start gap-4 p-4 rounded-xl border ${item.isUndone ? 'bg-red-500/10 border-red-500/20 opacity-60' : 'bg-[#111111] border-white/5 hover:border-white/10'}`}>
                            <div className={`text-sm font-bold w-12 pt-0.5 font-mono ${item.isUndone ? 'text-red-400/50 line-through' : 'text-[#4D78FF]'}`}>
                                {formatTime(item.ts, item.startTime)}
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] text-[#9CA3AF] font-black uppercase tracking-widest mb-1">{item.court}</div>
                                <p className={`text-sm font-bold ${item.isUndone ? 'text-content-muted line-through' : 'text-white'}`}>{item.message}</p>
                                {item.isUndone && <p className="text-[10px] text-red-400 font-bold mt-1 uppercase tracking-widest">Score Undone</p>}
                            </div>
                            {!item.isUndone && (
                                <div className="shrink-0 h-8 w-8 rounded-full bg-[#0A0A0A] flex items-center justify-center border border-white/10">
                                    {item.type.startsWith('START') ? <Timer size={14} className="text-[#9CA3AF]" /> : 
                                     item.tag?.toUpperCase() === 'ERROR' ? <X size={14} className="text-[#E65C31]" /> :
                                     <Trophy size={14} className="text-[#4D78FF]" />}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.02);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }
            `}</style>
        </div>
    );
};

const RecentMatchSummary = ({ match, teams }: any) => {
    const t1 = teams.find((t: any) => t.id === match.team1Id);
    const t2 = teams.find((t: any) => t.id === match.team2Id);
    const isT1Winner = match.winnerTeamId === t1?.id;

    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const t1DisplayName = formatCleanName(t1?.name || match.team1Name || [ getFirstName(t1?.player1?.name), getFirstName(t1?.player2?.name) ].filter(n => n && n.trim()).join(' & ') || 'TBA') || 'TBA';
    const t2DisplayName = formatCleanName(t2?.name || match.team2Name || [ getFirstName(t2?.player1?.name), getFirstName(t2?.player2?.name) ].filter(n => n && n.trim()).join(' & ') || 'TBA') || 'TBA';

    const isAmericanoMatch = match.roundName?.toLowerCase().includes("americano");

    return (
        <Card variant="panel" className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6 flex-1">
                <div className="flex flex-col items-center min-w-[80px]">
                    <div className={`text-2xl font-black ${isT1Winner ? 'text-[#E65C31]' : 'text-content-muted'}`}>{isT1Winner ? 'WIN' : 'LOST'}</div>
                    <div className="text-xs text-content-muted font-bold uppercase tracking-widest">{match.roundName}</div>
                </div>
                <div>
                    <div className={`text-xl font-black ${isT1Winner ? 'text-white' : 'text-content-muted'}`}>{t1DisplayName}</div>
                    <div className="text-xs text-content-muted font-bold uppercase">vs</div>
                    <div className={`text-xl font-black ${!isT1Winner ? 'text-white' : 'text-content-muted'}`}>{t2DisplayName}</div>
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <div className="flex gap-2">
                    {match.score.p1SetScores.map((s: number, i: number) => (
                        <div key={i} className="flex flex-col items-center bg-black/30 rounded-xl px-4 py-3 border border-white/5">
                            <span className="text-[10px] text-content-muted font-black mb-1">{isAmericanoMatch ? 'PTS' : `S${i+1}`}</span>
                            <div className="flex flex-col text-lg font-black leading-tight font-mono">
                                <span className={s > match.score.p2SetScores[i] ? 'text-white' : 'text-content-muted'}>{s}</span>
                                <span className={match.score.p2SetScores[i] > s ? 'text-white' : 'text-content-muted'}>{match.score.p2SetScores[i]}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-brand/10 text-brand p-4 rounded-2xl border border-brand/20">
                    <Award size={32} />
                </div>
            </div>
        </Card>
    );
};



export const StandingsTable = ({ tournamentId, categoryId, initialTeams, onTeamSelect, tournament, matches = [] }: { tournamentId: string, categoryId: string | null, initialTeams: any[], onTeamSelect?: (team: any) => void, tournament?: any, matches?: any[] }) => {
    const filterAccepted = (teams: any[]) => {
        return (teams || []).filter((t: any) => t.status === 'ACCEPTED' || t.status === 'accepted');
    };

    const [standings, setStandings] = useState<any[]>(() => {
        const source = (initialTeams && initialTeams.length > 0) ? initialTeams : (tournament?.teams || []);
        const filtered = source.filter((t: any) => isTeamInCategory(t, categoryId, tournament));
        return filterAccepted(filtered);
    });

    const activeCategoryObj = tournament?.categories?.find((c: any) => c.id === categoryId);
    const categoryName = activeCategoryObj?.name || '';

    useEffect(() => {
        if (!tournamentId) return;
        const STAT_KEYS = ['matchesPlayed', 'wins', 'losses', 'ties', 'points', 'setsWon', 'setsLost', 'gamesWon', 'gamesLost', 'gamesPlayed', 'pointsScored', 'pointsConceded', 'pointDifferential', 'missedMatchPoints', 'gd', 'knockoutStage', 'knockoutWeight', 'fipPpfPoints'];
        // Stored standings docs can be stale (e.g. they once folded knockout results into group
        // totals and spectators cannot self-heal them), so re-derive the stat columns from matches.
        const overlayDerivedStats = (teams: any[]) => {
            if (!tournament || !matches || matches.length === 0 || teams.length === 0) return teams;
            const derived = calculateStats(teams, matches, tournament.format, tournament.categories, tournament.pointsSystem);
            const byId = new Map(derived.map((d: any) => [d.id, d]));
            return teams.map((t: any) => {
                const d: any = byId.get(t.id);
                if (!d) return t;
                const out = { ...t };
                STAT_KEYS.forEach(k => { out[k] = d[k]; });
                return out;
            });
        };
        const unsub = subscribeToStandings(tournamentId, categoryId, (data) => {
            const source = (data && data.length > 0) ? data : (tournament?.teams || initialTeams || []);
            const filtered = overlayDerivedStats(source.filter((t: any) => isTeamInCategory(t, categoryId, tournament)));
            
            // Check if filtered has meaningful stats or if we should fallback to dynamic calculation
            const allZeroes = filtered.length > 0 && filtered.every((t: any) => (t.matchesPlayed || 0) === 0 && (t.wins || 0) === 0 && (t.points || 0) === 0);
            
            if ((filtered.length === 0 || allZeroes) && matches && matches.length > 0 && tournament) {
                const categoryTeams = (tournament.teams || source).filter((t: any) => isTeamInCategory(t, categoryId, tournament));
                if (categoryTeams.length > 0) {
                    const computed = calculateStats(categoryTeams, matches, tournament.format, tournament.categories, tournament.pointsSystem);
                    setStandings(filterAccepted(computed));
                    return;
                }
            }

            setStandings(filterAccepted(filtered));
        }, tournament);
        return () => unsub();
    }, [tournamentId, categoryId, tournament, initialTeams, matches]);

    // Self-heal DB stats in background when tournament & matches exist
    useEffect(() => {
        if (tournament && matches && matches.length > 0) {
            // checkAndHealTournamentStats(tournament, matches, categoryId); // Disabled in LiveScoreboard to prevent permission errors for spectators
        }
    }, [tournament, matches, categoryId]);

    const groups = standings.reduce((acc: any, team: any) => {
        const gid = team.groupId || 'A';
        if (!acc[gid]) acc[gid] = [];
        acc[gid].push(team);
        return acc;
    }, {});

    const groupKeys = Object.keys(groups).sort();
    const isAmericano = tournament?.format === 'AMERICANO' || tournament?.format === 'MEXICANO';

    if (tournament && isTeamAmericanoFormat(getActiveFormat(tournament, categoryId))) {
        return <TeamAmericanoStandings tournament={tournament} categoryId={categoryId} matches={matches} onTeamSelect={onTeamSelect} />;
    }

    return (
        <div className="space-y-8 w-full max-w-full">
            {groupKeys.map(gId => (
                <div key={gId} className="animate-in slide-in-from-right duration-700 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                        <h3 className="text-[#4D78FF] font-black text-sm uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#4D78FF] animate-pulse" />
                            {isAmericano ? "LEADERBOARD" : `GROUP ${gId} STANDINGS`}
                        </h3>
                    </div>
                    <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden w-full">
                        <div className="overflow-x-auto scrollbar-none w-full">
                            <table className="w-full text-left font-mono">
                                <thead className="bg-[#111111] text-[10px] text-content-muted font-black uppercase tracking-widest border-b border-white/10">
                                    <tr>
                                        <th className="px-1.5 sm:px-3 md:px-6 py-3 text-left">TEAM</th>
                                        {isAmericano ? (
                                            <>
                                                <th className="px-1 sm:px-2 text-center py-3" title="Matches Played">P</th>
                                                <th className="px-1 sm:px-2 text-center py-3" title="Matches Won">W</th>
                                                <th className="px-1 sm:px-2 text-center py-3" title="Matches Lost">L</th>
                                                <th className="px-1 sm:px-2 text-center py-3 text-[#10B981]" title="Points">PTS</th>
                                                <th className="px-1 sm:px-2 text-center py-3 text-[#EF4444]" title="Points Against">PA</th>
                                                <th className="px-1 sm:px-2 text-right py-3 pr-2.5 sm:pr-4 text-[#4D78FF]" title="Point Differential">PD</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-1.5 sm:px-3 text-center py-3" title="Matches Won">W</th>
                                                <th className="px-1.5 sm:px-3 text-center py-3" title="Matches Lost">L</th>
                                                <th className="px-1.5 sm:px-3 text-center py-3" title="Games Won">G.W</th>
                                                <th className="px-1.5 sm:px-3 text-center py-3" title="Games Lost">G.L</th>
                                                <th className="px-1.5 sm:px-3 text-center py-3 text-[#4D78FF]" title="Game Difference">GD</th>
                                                <th className="px-1.5 sm:px-3 text-right py-3 pr-2.5 sm:pr-4 text-[#4D78FF]" title="Points">PTS</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(groups[gId] || []).sort((a: any, b: any) => {
                                        // 1st rule: Points (PTS) descending (highest first)
                                        const ptsA = a.points || 0;
                                        const ptsB = b.points || 0;
                                        if (ptsB !== ptsA) {
                                            return ptsB - ptsA;
                                        }
                                        
                                        // 2nd rule: Game Difference (GD) descending (highest first)
                                        const gdA = (a.gamesWon || 0) - (a.gamesLost || 0);
                                        const gdB = (b.gamesWon || 0) - (b.gamesLost || 0);
                                        if (gdB !== gdA) {
                                            return gdB - gdA;
                                        }

                                        // 3rd rule: Games Won (G.W) descending
                                        const gwA = a.gamesWon || 0;
                                        const gwB = b.gamesWon || 0;
                                        if (gwB !== gwA) {
                                            return gwB - gwA;
                                        }

                                        // Fallback: Games Lost (GL) ascending (fewer games lost is better)
                                        const glA = a.gamesLost || 0;
                                        const glB = b.gamesLost || 0;
                                        return glA - glB;
                                    }).map((s: any, i: number) => {
                                        const isTop2 = i < 2;
                                        return (
                                            <tr 
                                                key={s.id} 
                                                onClick={() => onTeamSelect && onTeamSelect(s)}
                                                className={`hover:bg-white/[0.03] transition-colors group ${onTeamSelect ? 'cursor-pointer' : ''}`}
                                            >
                                                <td className="px-1.5 sm:px-3 md:px-6 py-3 flex items-center gap-1.5 md:gap-3 relative">
                                                    
{i === 0 ? ( <span className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 bg-[#FFD700] text-[#8B6508] shadow-[0_0_10px_rgba(255,215,0,0.5)]">{i + 1}</span> ) : i === 1 ? ( <span className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 bg-[#C0C0C0] text-[#4A4A4A] shadow-[0_0_10px_rgba(192,192,192,0.4)]">{i + 1}</span> ) : i === 2 ? ( <span className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 bg-[#CD7F32] text-[#5C3A16] shadow-[0_0_10px_rgba(205,127,50,0.4)]">{i + 1}</span> ) : ( <span className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 bg-white/10 text-gray-400">{i + 1}</span> )}
                                                    <span className="font-black tracking-[0.05em] md:tracking-[0.15em] text-xs md:text-base truncate max-w-[95px] xs:max-w-[130px] sm:max-w-[200px] md:max-w-none text-white">
                                                        {s.name || 'TBA'}
                                                    </span>
                                                    {onTeamSelect && <ChevronRight size={14} className="text-[#9CA3AF] opacity-50 group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-white transition-all shrink-0 ml-1 hidden sm:block" />}
                                                </td>
                                                {isAmericano ? (
                                                    <>
                                                        <td className="px-1 sm:px-2 text-center py-3 text-[#8A9AB0] font-medium text-xs md:text-sm">
                                                            {s.matchesPlayed || 0}
                                                        </td>
                                                        <td className="px-1 sm:px-2 text-center py-3 text-[#10B981] font-bold text-xs md:text-sm">
                                                            {s.wins || 0}
                                                        </td>
                                                        <td className="px-1 sm:px-2 text-center py-3 text-[#EF4444] font-bold text-xs md:text-sm">
                                                            {s.losses || 0}
                                                        </td>
                                                        <td className="px-1 sm:px-2 text-center py-3 text-[#4D78FF] font-black text-sm md:text-lg">
                                                            {s.points || 0}
                                                        </td>
                                                        <td className="px-1 sm:px-2 text-center py-3 text-[#8A9AB0] font-medium text-xs md:text-sm">
                                                            {s.pointsConceded || s.gamesLost || 0}
                                                        </td>
                                                        <td className="px-1 sm:px-2 text-right py-3 pr-2.5 sm:pr-4 text-white font-bold text-xs md:text-sm">
                                                            {s.pointDifferential > 0 ? `+${s.pointDifferential}` : s.pointDifferential || 0}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-1.5 sm:px-3 text-center py-3 text-[#10B981] font-bold text-xs md:text-sm">
                                                            {s.wins || 0}
                                                        </td>
                                                        <td className="px-1.5 sm:px-3 text-center py-3 text-[#EF4444] font-bold text-xs md:text-sm">
                                                            {s.losses || 0}
                                                        </td>
                                                        <td className="px-1.5 sm:px-3 text-center py-3 text-[#8A9AB0] font-medium text-xs md:text-sm">
                                                            {s.gamesWon || 0}
                                                        </td>
                                                        <td className="px-1.5 sm:px-3 text-center py-3 text-[#8A9AB0] font-medium text-xs md:text-sm">
                                                            {s.gamesLost || 0}
                                                        </td>
                                                        <td className="px-1.5 sm:px-3 text-center py-3 text-[#8A9AB0] font-bold text-xs md:text-sm">
                                                            {(s.gamesWon || 0) - (s.gamesLost || 0)}
                                                        </td>
                                                        <td className="px-1.5 sm:px-3 text-right py-3 pr-2.5 sm:pr-4 text-[#4D78FF] font-black text-sm md:text-lg">
                                                            {s.points || 0}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            ))}

        </div>
    );
};

const ScheduleRow = ({ match, teams }: any) => {
    const t1Obj = teams.find((t: any) => t.id === match.team1Id);
    const t2Obj = teams.find((t: any) => t.id === match.team2Id);
    
    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const t1DisplayName = formatCleanName(t1Obj?.name || match.team1Name || [ getFirstName(t1Obj?.player1?.name), getFirstName(t1Obj?.player2?.name) ].filter(n => n && n.trim()).join(' & ') || 'TBD') || 'TBD';
    const t2DisplayName = formatCleanName(t2Obj?.name || match.team2Name || [ getFirstName(t2Obj?.player1?.name), getFirstName(t2Obj?.player2?.name) ].filter(n => n && n.trim()).join(' & ') || 'TBD') || 'TBD';

    return (
        <Card variant="panel" className="p-6 flex justify-between items-center hover:bg-white/[0.02] transition-colors group">
            <div className="flex items-center gap-6">
                <div className="h-12 w-12 rounded-xl bg-black/20 flex flex-col items-center justify-center border border-white/5">
                    <span className="text-[10px] text-content-muted font-black uppercase">Start</span>
                    <span className="text-white font-black text-sm">{formatTimeOnly(match.scheduledTime)}</span>
                </div>
                <div>
                    <div className="text-accent-info text-[10px] font-black uppercase mb-1 tracking-wider">{match.roundName}</div>
                    <div className="text-white font-black text-lg group-hover:text-accent-info-light transition-colors">
                        {t1DisplayName} <span className="text-content-muted text-sm px-2 font-normal italic">vs</span> {t2DisplayName}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="bg-accent-info/10 text-accent-info px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-accent-info/20">
                    {match.court}
                </div>
            </div>
        </Card>
    )
};

const LIVE_PAGE_SIZE = 6;

const PaginationBar = ({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-center gap-4 shrink-0 py-2">
            <button
                onClick={() => onChange(page - 1)}
                disabled={page === 0}
                aria-label="Previous page"
                className="p-2 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
                <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-black uppercase tracking-widest text-white/60 font-mono">
                Page {page + 1} / {totalPages}
            </span>
            <button
                onClick={() => onChange(page + 1)}
                disabled={page >= totalPages - 1}
                aria-label="Next page"
                className="p-2 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
};

// ─── Broadcast mode (court-side TV wall) ────────────────────────────────────
// Scoreboard wall: up to 6 live matches per page (2 x 3 grid), S1/S2/S3 set
// columns + current point box per team, sponsor strip at the bottom. With more
// than 6 live matches the operator pages manually. Colours come from the
// tournament's broadcastTheme (Matchup dark by default, FIP blue, or light).
const FIP_FONT = "'Barlow Condensed', 'Barlow', 'Inter', sans-serif";
// Shared by the card header and both team rows so labels line up with values.
const FIP_COLS = 'minmax(0,1fr) repeat(3, 8.5cqw) 17cqw';
// Americano formats are a single running points total: no set columns.
const FIP_COLS_POINTS = 'minmax(0,1fr) 17cqw';

interface BroadcastPalette {
    pageBg: string;
    decor: false | 'fip' | 'ribbon' | 'sofcom'; // background decoration set
    pageText: string;
    pageMuted: string;
    chipBg: string;
    chipBorder: string;
    logoColor?: string; // undefined = white Matchup logo
    cardBorder: string;
    cardShadow: string;
    cardAccent?: string; // left accent bar
    cardTopAccent?: string; // thin stripe across the top of each card
    titleAccent?: string; // short bar under the tournament title
    headBg: string;
    headText: string;
    bodyBg: string;
    divider: string;
    nameText: string;
    setText: string;
    setCurrent: string;
    scoreBg: string;
    scoreText: string;
    serveDot: string;
    footBg: string;
    footText: string;
    statusBg: string;
    roundBg: string;
    roundText: string;
    flashBg: string;
    flashText: string;
    stripBg: string;
    stripBorder: string;
    tickerLabelBg: string;
    tickerText: string;
}

const BROADCAST_THEMES: Record<BroadcastTheme, BroadcastPalette> = {
    // Matchup brand: near-black stage, graphite cards, logo blue accents.
    matchup: {
        pageBg: [
            'radial-gradient(ellipse 60% 50% at 85% -10%, rgba(77,120,255,0.20), transparent 70%)',
            'radial-gradient(ellipse 50% 45% at 0% 110%, rgba(230,92,49,0.10), transparent 70%)',
            '#0d0d0f',
        ].join(', '),
        decor: false,
        pageText: '#ffffff',
        pageMuted: 'rgba(255,255,255,0.6)',
        chipBg: 'rgba(255,255,255,0.05)',
        chipBorder: 'rgba(255,255,255,0.1)',
        cardBorder: '1px solid rgba(255,255,255,0.06)',
        cardShadow: '0 1.6cqh 4.5cqh rgba(0,0,0,0.55)',
        cardAccent: '#4D78FF',
        headBg: '#1c1c22',
        headText: 'rgba(255,255,255,0.55)',
        bodyBg: '#16161a',
        divider: 'rgba(255,255,255,0.08)',
        nameText: '#ffffff',
        setText: '#ffffff',
        setCurrent: '#7093FF',
        scoreBg: 'linear-gradient(180deg, #4D78FF, #2F59E5)',
        scoreText: '#ffffff',
        serveDot: '#E65C31',
        footBg: '#111114',
        footText: 'rgba(255,255,255,0.75)',
        statusBg: 'rgba(255,255,255,0.08)',
        roundBg: 'rgba(77,120,255,0.18)',
        roundText: '#9db3ff',
        flashBg: 'rgba(13,13,15,0.9)',
        flashText: '#ffffff',
        stripBg: '#ffffff',
        stripBorder: 'transparent',
        tickerLabelBg: '#4D78FF',
        tickerText: '#0d0d0f',
    },
    // FIP federation look: Midnight Blue (#002C5C) stage with Big Stone
    // (#17253F) and white, kept deliberately clear of any warm/orange glow.
    fip: {
        pageBg: [
            'radial-gradient(ellipse 70% 60% at 100% 0%, rgba(58,124,214,0.38) 0%, rgba(58,124,214,0.10) 45%, transparent 72%)',
            'radial-gradient(ellipse 60% 55% at 0% 100%, rgba(23,37,63,0.85) 0%, transparent 70%)',
            'linear-gradient(155deg, #17253F 0%, #002C5C 48%, #003b78 100%)',
        ].join(', '),
        decor: 'fip',
        pageText: '#ffffff',
        pageMuted: 'rgba(255,255,255,0.68)',
        chipBg: 'rgba(255,255,255,0.08)',
        chipBorder: 'rgba(255,255,255,0.16)',
        cardBorder: '1px solid rgba(255,255,255,0.08)',
        cardShadow: '0 1.6cqh 4.5cqh rgba(0,10,30,0.5)',
        cardTopAccent: 'linear-gradient(90deg, #ffffff 0%, #9cc2ff 35%, #2f6fd6 70%, #002C5C 100%)',
        titleAccent: 'linear-gradient(90deg, transparent, #ffffff 30%, #9cc2ff 70%, transparent)',
        headBg: '#17253F',
        headText: 'rgba(255,255,255,0.78)',
        bodyBg: '#ffffff',
        divider: 'rgba(0,44,92,0.1)',
        nameText: '#002C5C',
        setText: '#17253F',
        setCurrent: '#2f6fd6',
        scoreBg: 'linear-gradient(180deg, #003a78 0%, #002C5C 100%)',
        scoreText: '#ffffff',
        serveDot: '#2f6fd6',
        footBg: '#17253F',
        footText: 'rgba(255,255,255,0.8)',
        statusBg: 'rgba(255,255,255,0.1)',
        roundBg: '#ffffff',
        roundText: '#002C5C',
        flashBg: 'rgba(0,44,92,0.92)',
        flashText: '#ffffff',
        stripBg: '#ffffff',
        stripBorder: 'transparent',
        tickerLabelBg: '#002C5C',
        tickerText: '#002C5C',
    },
    // Pink Ribbon: for Pinktober / breast-cancer awareness events. Deep plum
    // to raspberry stage, white cards, hot-pink scores, awareness ribbon motif.
    pinktober: {
        pageBg: [
            'radial-gradient(ellipse 55% 50% at 8% 0%, rgba(255,140,198,0.42) 0%, rgba(255,140,198,0.10) 50%, transparent 72%)',
            'radial-gradient(ellipse 60% 60% at 100% 100%, rgba(232,62,140,0.45) 0%, transparent 70%)',
            'linear-gradient(150deg, #3a0a2a 0%, #6b1048 48%, #9c1857 100%)',
        ].join(', '),
        decor: 'ribbon',
        pageText: '#ffffff',
        pageMuted: 'rgba(255,255,255,0.72)',
        chipBg: 'rgba(255,255,255,0.10)',
        chipBorder: 'rgba(255,255,255,0.20)',
        cardBorder: '1px solid rgba(255,255,255,0.10)',
        cardShadow: '0 1.6cqh 4.5cqh rgba(40,0,25,0.5)',
        cardTopAccent: 'linear-gradient(90deg, #ffd6e8 0%, #ff8cc6 40%, #e83e8c 75%, #9c1857 100%)',
        titleAccent: 'linear-gradient(90deg, transparent, #ffd6e8 30%, #ff8cc6 70%, transparent)',
        headBg: '#4a0d35',
        headText: 'rgba(255,255,255,0.8)',
        bodyBg: '#ffffff',
        divider: 'rgba(107,16,72,0.1)',
        nameText: '#4a0d35',
        setText: '#4a0d35',
        setCurrent: '#e83e8c',
        scoreBg: 'linear-gradient(180deg, #ff4f9a 0%, #d6336c 100%)',
        scoreText: '#ffffff',
        serveDot: '#e83e8c',
        footBg: '#4a0d35',
        footText: 'rgba(255,255,255,0.82)',
        statusBg: 'rgba(255,255,255,0.10)',
        roundBg: '#ffd6e8',
        roundText: '#6b1048',
        flashBg: 'rgba(74,13,53,0.92)',
        flashText: '#ffffff',
        stripBg: '#ffffff',
        stripBorder: 'transparent',
        tickerLabelBg: '#d6336c',
        tickerText: '#4a0d35',
    },
    // Sofcom (The Harmony Games): black stage lit by orange flame swooshes
    // built around #E85624, white cards with orange headers, lime serve dot
    // like the tennis ball in the event artwork.
    sofcom: {
        pageBg: [
            'radial-gradient(ellipse 45% 32% at 100% 38%, rgba(255,122,40,0.55) 0%, rgba(232,86,36,0.22) 45%, transparent 75%)',
            'radial-gradient(ellipse 40% 30% at 0% 64%, rgba(255,122,40,0.50) 0%, rgba(232,86,36,0.20) 45%, transparent 75%)',
            'radial-gradient(ellipse 70% 45% at 50% 115%, rgba(232,86,36,0.18), transparent 70%)',
            'linear-gradient(180deg, #050505 0%, #0b0705 55%, #120804 100%)',
        ].join(', '),
        decor: 'sofcom',
        pageText: '#ffffff',
        pageMuted: 'rgba(255,255,255,0.68)',
        chipBg: 'rgba(232,86,36,0.12)',
        chipBorder: 'rgba(232,86,36,0.45)',
        cardBorder: '1px solid rgba(232,86,36,0.35)',
        cardShadow: '0 1.6cqh 4.5cqh rgba(0,0,0,0.6), 0 0 3cqh rgba(232,86,36,0.18)',
        cardTopAccent: 'linear-gradient(90deg, #FF8A3D 0%, #E85624 45%, #B83A12 100%)',
        titleAccent: 'linear-gradient(90deg, transparent, #FF8A3D 25%, #E85624 75%, transparent)',
        headBg: 'linear-gradient(90deg, #E85624 0%, #F26B35 100%)',
        headText: 'rgba(255,255,255,0.92)',
        bodyBg: '#ffffff',
        divider: 'rgba(232,86,36,0.18)',
        nameText: '#111111',
        setText: '#1a1a1a',
        setCurrent: '#E85624',
        scoreBg: 'linear-gradient(180deg, #F26B35 0%, #E85624 55%, #C4441A 100%)',
        scoreText: '#ffffff',
        serveDot: '#C6E03A',
        footBg: '#111111',
        footText: 'rgba(255,255,255,0.82)',
        statusBg: 'rgba(255,255,255,0.08)',
        roundBg: '#E85624',
        roundText: '#ffffff',
        flashBg: 'rgba(10,6,4,0.92)',
        flashText: '#ffffff',
        stripBg: '#ffffff',
        stripBorder: 'rgba(232,86,36,0.4)',
        tickerLabelBg: '#E85624',
        tickerText: '#111111',
    },
    // Light: for bright venues and daytime screens.
    light: {
        pageBg: [
            'radial-gradient(ellipse 60% 50% at 90% -10%, rgba(77,120,255,0.14), transparent 70%)',
            'radial-gradient(ellipse 50% 45% at 0% 110%, rgba(230,92,49,0.08), transparent 70%)',
            'linear-gradient(160deg, #f7f9fc 0%, #eaeef5 100%)',
        ].join(', '),
        decor: false,
        pageText: '#0f172a',
        pageMuted: 'rgba(15,23,42,0.55)',
        chipBg: '#ffffff',
        chipBorder: 'rgba(15,23,42,0.1)',
        logoColor: '#4D78FF',
        cardBorder: '1px solid rgba(15,23,42,0.08)',
        cardShadow: '0 1.2cqh 3.5cqh rgba(15,23,42,0.10)',
        headBg: '#f1f4fa',
        headText: 'rgba(15,23,42,0.5)',
        bodyBg: '#ffffff',
        divider: 'rgba(15,23,42,0.08)',
        nameText: '#0f172a',
        setText: '#0f172a',
        setCurrent: '#4D78FF',
        scoreBg: 'linear-gradient(180deg, #4D78FF, #2F59E5)',
        scoreText: '#ffffff',
        serveDot: '#E65C31',
        footBg: '#f8fafc',
        footText: 'rgba(15,23,42,0.65)',
        statusBg: 'rgba(15,23,42,0.06)',
        roundBg: '#4D78FF',
        roundText: '#ffffff',
        flashBg: 'rgba(255,255,255,0.94)',
        flashText: '#0f172a',
        stripBg: '#ffffff',
        stripBorder: 'rgba(15,23,42,0.08)',
        tickerLabelBg: '#4D78FF',
        tickerText: '#0f172a',
    },
};

const getBroadcastPalette = (t?: Tournament | null) => BROADCAST_THEMES[(t?.broadcastTheme as BroadcastTheme) || 'matchup'] || BROADCAST_THEMES.matchup;

const isMatchFinished = (m: any) => {
    const s = String(m?.status || '').toUpperCase();
    return s === 'COMPLETED' || s === 'FINISHED' || !!m?.winnerTeamId;
};

const isMatchLive = (m: any) => {
    const s = String(m?.status || '').toUpperCase();
    return (m?.status === MatchStatus.IN_PROGRESS || s === 'LIVE' || s === 'IN_PROGRESS') && !m?.winnerTeamId;
};

// Broadcast-style names: short names stay whole ("SAFINA EJAZ"), long ones
// keep the surname and shorten the rest to initials ("M M FERNANDES").
const formatBroadcastPlayerName = (name?: string | null) => {
    const parts = formatCleanName(name).split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const full = parts.join(' ');
    if (parts.length === 1 || full.length <= 14) return full.toUpperCase();
    return [...parts.slice(0, -1).map(p => p[0]), parts[parts.length - 1]].join(' ').toUpperCase();
};

const describePoint = (finisher?: string, tag?: string) => {
    if (finisher === 'smash') return 'SMASH WINNER';
    if (finisher === 'vibora') return 'VIBORA WINNER';
    if (finisher === 'drop' || finisher === 'drop shot') return 'DROP SHOT WINNER';
    if (finisher === 'bandeja') return 'BANDEJA WINNER';
    if (finisher === 'volley') return 'VOLLEY WINNER';
    if (tag === 'winner') return 'WINNER';
    if (tag === 'error') return 'UNFORCED ERROR';
    if (finisher === 'net') return 'NET ERROR';
    if (finisher === 'glass') return 'GLASS ERROR';
    if (finisher === 'double fault') return 'DOUBLE FAULT';
    if (finisher === 'grill') return 'GRILL ERROR';
    return 'POINT WON';
};

const BroadcastMode = ({ tournament, onClose }: { tournament: Tournament, onClose: () => void }) => {
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    const [selectedMatchId, setSelectedMatchId] = useState<string | 'ALL'>('ALL');
    const [page, setPage] = useState(0);
    const [sponsors, setSponsors] = useState<any[]>([]);
    const [sponsorsLoaded, setSponsorsLoaded] = useState(false);
    const liveMatches = globalMatches.filter(isMatchLive);
    const theme = getBroadcastPalette(tournament);

    // useTournamentDoc doesn't load the sponsors subcollection, so subscribe
    // here for the bottom sponsor strip.
    useEffect(() => {
        if (!db || !tournament.id) return;
        const unsub = onSnapshot(
            collection(db, 'tournaments', tournament.id, 'sponsors'),
            snap => { setSponsors(sortSponsors(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))); setSponsorsLoaded(true); },
            err => { console.error('Error loading sponsors:', err); setSponsorsLoaded(true); }
        );
        return () => unsub();
    }, [tournament.id]);

    useEffect(() => {
        // If the match being viewed full-screen ended (or otherwise dropped out
        // of the live list), fall back to the grid instead of showing "no live
        // matches" while other matches are still live.
        if (selectedMatchId !== 'ALL' && !liveMatches.some(m => m.id === selectedMatchId)) {
            setSelectedMatchId('ALL');
        }
    }, [liveMatches, selectedMatchId]);

    const activeMatch = selectedMatchId !== 'ALL' ? liveMatches.find(m => m.id === selectedMatchId) : null;

    const totalPages = Math.max(1, Math.ceil(liveMatches.length / LIVE_PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageMatches = liveMatches.slice(safePage * LIVE_PAGE_SIZE, (safePage + 1) * LIVE_PAGE_SIZE);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setPage(p => Math.min(p + 1, totalPages - 1));
            else if (e.key === 'ArrowLeft') setPage(p => Math.max(p - 1, 0));
            else if (e.key === 'Escape' && selectedMatchId !== 'ALL') setSelectedMatchId('ALL');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [totalPages, selectedMatchId]);

    const stripSponsors = (sponsors.length > 0 ? sponsors : (tournament.sponsors || [])).filter((s: any) => s?.logo);

    const yearSource = tournament.startDate || tournament.createdAt;
    const year = yearSource && !isNaN(new Date(yearSource).getFullYear()) ? String(new Date(yearSource).getFullYear()) : '';
    const showYear = !!year && !String(tournament.name || '').includes(year);

    // While paging, every page keeps the full 6-slot grid so a lone match on
    // the last page doesn't blow up to full-screen and look like it was opened.
    const n = totalPages > 1 ? LIVE_PAGE_SIZE : pageMatches.length;
    const gridClass =
        n === 1 ? 'h-full flex items-center justify-center' :
        n === 2 ? 'h-full flex flex-col items-center justify-center gap-[2.5vh]' :
        n <= 4 ? 'grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-[2vh] md:h-full' :
        'grid grid-cols-1 md:grid-cols-2 md:grid-rows-3 gap-[1.6vh] md:h-full';
    // Every cell is a size container so the card's cqh/cqw-based type scales
    // with whatever space the layout gives it.
    const cellClass =
        n === 1 ? 'w-full max-w-[1500px] aspect-[2.6/1] md:aspect-auto md:h-[62%]' :
        n === 2 ? 'w-full max-w-[1500px] aspect-[2.6/1] md:aspect-auto md:h-[45%]' :
        'aspect-[2.4/1] md:aspect-auto md:min-h-0';

    const chipStyle = { background: theme.chipBg, borderColor: theme.chipBorder };

    return createPortal(
        // SAFE-ZONE: many TVs driven over HDMI crop 3-5% per edge (overscan),
        // so the percentage padding keeps everything inside a safe area that
        // scales with the actual screen size.
        <div
            className="fixed inset-0 z-[11000] flex flex-col overflow-hidden p-[3%] sm:p-[2.5%] gap-[1.8vh] select-none"
            style={{ background: theme.pageBg, color: theme.pageText, fontFamily: FIP_FONT }}
        >
            {theme.decor === 'fip' && (
                <>
                    {/* Sporty decoration, purely visual: fine speed lines fading in
                        from the right, a broad diagonal slash band, and a faint
                        padel-court outline in the bottom-left corner. */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 26px)',
                            maskImage: 'linear-gradient(90deg, transparent 35%, black 90%)',
                            WebkitMaskImage: 'linear-gradient(90deg, transparent 35%, black 90%)',
                        }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: [
                                'linear-gradient(115deg, transparent 0 58%, rgba(255,255,255,0.065) 58% 70%, transparent 70%)',
                                'linear-gradient(115deg, transparent 0 71.5%, rgba(255,255,255,0.09) 71.5% 72.2%, transparent 72.2%)',
                            ].join(', '),
                        }}
                    />
                    <svg
                        className="absolute pointer-events-none"
                        style={{ left: '-4vw', bottom: '-10vh', width: '42vw', height: '60vh', opacity: 0.07 }}
                        viewBox="0 0 200 100"
                        preserveAspectRatio="none"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="0.8"
                        aria-hidden="true"
                    >
                        <rect x="2" y="2" width="196" height="96" />
                        <line x1="100" y1="2" x2="100" y2="98" />
                        <line x1="30" y1="2" x2="30" y2="98" />
                        <line x1="170" y1="2" x2="170" y2="98" />
                        <line x1="30" y1="50" x2="170" y2="50" />
                    </svg>
                </>
            )}
            {theme.decor === 'ribbon' && (
                <>
                    {/* Pink Ribbon decoration, purely visual: soft light spots and
                        a large faint awareness-ribbon outline on the right. */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: [
                                'radial-gradient(circle at 18% 72%, rgba(255,214,232,0.10) 0 6vh, transparent 6.2vh)',
                                'radial-gradient(circle at 42% 18%, rgba(255,214,232,0.07) 0 3.5vh, transparent 3.7vh)',
                                'radial-gradient(circle at 63% 88%, rgba(255,214,232,0.06) 0 9vh, transparent 9.2vh)',
                                'radial-gradient(circle at 88% 40%, rgba(255,214,232,0.05) 0 4vh, transparent 4.2vh)',
                                'linear-gradient(120deg, transparent 0 62%, rgba(255,255,255,0.05) 62% 66%, transparent 66%)',
                            ].join(', '),
                        }}
                    />
                    <svg
                        className="absolute pointer-events-none"
                        style={{ right: '3vw', top: '8vh', height: '88vh', width: 'auto', opacity: 0.09 }}
                        viewBox="0 0 120 200"
                        fill="none"
                        stroke="#ffd6e8"
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M60 18 C 34 18, 26 52, 44 82 L 92 186" />
                        <path d="M60 18 C 86 18, 94 52, 76 82 L 28 186" />
                    </svg>
                </>
            )}

            {theme.decor === 'sofcom' && (
                <>
                    {/* Sofcom decoration, purely visual and static: two glowing
                        orange swooshes sweeping across the stage (the flame bands
                        in the event artwork) and a faint dot grid. */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.2px)',
                            backgroundSize: '3.2vh 3.2vh',
                            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 85%)',
                            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 85%)',
                        }}
                    />
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                            <linearGradient id="sofcomSwooshA" x1="0" x2="1" y1="0" y2="0">
                                <stop offset="0" stopColor="#E85624" stopOpacity="0" />
                                <stop offset="0.35" stopColor="#FF8A3D" stopOpacity="0.9" />
                                <stop offset="0.7" stopColor="#E85624" stopOpacity="0.55" />
                                <stop offset="1" stopColor="#E85624" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="sofcomSwooshB" x1="1" x2="0" y1="0" y2="0">
                                <stop offset="0" stopColor="#E85624" stopOpacity="0" />
                                <stop offset="0.3" stopColor="#FF9A4D" stopOpacity="0.85" />
                                <stop offset="0.75" stopColor="#E85624" stopOpacity="0.4" />
                                <stop offset="1" stopColor="#E85624" stopOpacity="0" />
                            </linearGradient>
                            <filter id="sofcomGlow" x="-10%" y="-50%" width="120%" height="200%">
                                <feGaussianBlur stdDeviation="18" />
                            </filter>
                        </defs>
                        <path d="M-60 560 C 260 420, 420 700, 760 560" fill="none" stroke="url(#sofcomSwooshA)" strokeWidth="70" strokeLinecap="round" filter="url(#sofcomGlow)" opacity="0.55" />
                        <path d="M-60 560 C 260 420, 420 700, 760 560" fill="none" stroke="url(#sofcomSwooshA)" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
                        <path d="M1660 300 C 1340 220, 1180 470, 860 330" fill="none" stroke="url(#sofcomSwooshB)" strokeWidth="80" strokeLinecap="round" filter="url(#sofcomGlow)" opacity="0.55" />
                        <path d="M1660 300 C 1340 220, 1180 470, 860 330" fill="none" stroke="url(#sofcomSwooshB)" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
                    </svg>
                </>
            )}

            {/* Header: Matchup logo | brand logo · tournament title · live count, pages, close */}
            <header className="relative z-10 shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-4 min-h-[max(10vh,56px)]">
                <div className="flex items-center h-full min-w-0 gap-[1.2vw]">
                    <Logo size={84} variant="white" color={theme.logoColor} className="shrink-0 !w-[clamp(48px,8vh,84px)] !h-auto aspect-[800/586]" />
                    {tournament.organizerLogo && (
                        <>
                            <span className="w-px h-[clamp(28px,5.5vh,64px)] shrink-0" style={{ background: theme.pageMuted }} />
                            <img
                                src={tournament.organizerLogo}
                                alt={tournament.organizer || 'Organiser'}
                                className="h-[clamp(36px,7vh,80px)] w-auto max-w-[16vw] object-contain rounded-[0.6vh]"
                            />
                        </>
                    )}
                </div>
                <div className="text-center min-w-0">
                    {/* Italic (slanted) text overhangs its box: the padding keeps
                        the last glyph from being clipped by truncate's overflow. */}
                    <div className={`italic font-bold uppercase tracking-tight whitespace-nowrap truncate leading-[1.1] px-[0.2em] text-[clamp(22px,5.4vh,72px)] ${theme.decor ? 'drop-shadow-[0_3px_10px_rgba(0,0,0,0.35)]' : ''}`}>
                        {tournament.name}
                        {showYear && (
                            <>
                                <span className="mx-[0.3em] font-normal opacity-80">|</span>
                                {year}
                            </>
                        )}
                    </div>
                    {theme.titleAccent && (
                        <div className="mx-auto mt-[0.4vh] h-[3px] w-[40%] rounded-full" style={{ background: theme.titleAccent }} />
                    )}
                    {tournament.venue && (
                        <div className="mt-[0.6vh] flex items-center justify-center gap-[0.5em] text-[clamp(10px,1.5vh,18px)] font-bold tracking-[0.35em] uppercase truncate" style={{ color: theme.pageMuted }}>
                            {theme.decor === 'ribbon' && (
                                // Awareness ribbon mark for Pinktober events.
                                <svg viewBox="0 0 120 200" className="h-[1.6em] w-auto shrink-0" fill="none" stroke="#ff8cc6" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M60 18 C 34 18, 26 52, 44 82 L 92 186" />
                                    <path d="M60 18 C 86 18, 94 52, 76 82 L 28 186" />
                                </svg>
                            )}
                            <span className="truncate">{tournament.venue}</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end justify-center gap-[0.8vh]">
                    <div className="flex items-center gap-2">
                        {liveMatches.length > 0 && (
                            <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-[clamp(11px,1.6vh,20px)] font-bold uppercase tracking-widest" style={chipStyle}>
                                <span className="w-2 h-2 rounded-full bg-[#ff3b3b] animate-pulse shadow-[0_0_8px_#ff3b3b]" />
                                {liveMatches.length} Live
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full border cursor-pointer opacity-40 hover:opacity-100 transition-opacity"
                            style={{ ...chipStyle, color: theme.pageText }}
                            title="Close Broadcast Mode"
                            aria-label="Close Broadcast Mode"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    {selectedMatchId === 'ALL' && totalPages > 1 && (
                        <div className="flex items-center gap-2 text-[clamp(11px,1.5vh,18px)] font-bold uppercase tracking-widest">
                            <button
                                onClick={() => setPage(Math.max(safePage - 1, 0))}
                                disabled={safePage === 0}
                                aria-label="Previous page"
                                className="p-1.5 rounded-full border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity hover:opacity-80"
                                style={chipStyle}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="tabular-nums">Page {safePage + 1} / {totalPages}</span>
                            <button
                                onClick={() => setPage(Math.min(safePage + 1, totalPages - 1))}
                                disabled={safePage >= totalPages - 1}
                                aria-label="Next page"
                                className="p-1.5 rounded-full border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity hover:opacity-80"
                                style={chipStyle}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main stage */}
            <main className="relative z-10 flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
                {selectedMatchId === 'ALL' && liveMatches.length > 0 ? (
                    // Keyed fade-in only: an exit animation would hold the old
                    // page on screen until it finished.
                    <motion.div
                            key={safePage}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            className={gridClass}
                        >
                            {pageMatches.map(m => (
                                // Clicking a card switches to that match full-screen
                                // (only meaningful when there's more than one live).
                                <div
                                    key={m.id}
                                    onClick={liveMatches.length > 1 ? () => setSelectedMatchId(m.id) : undefined}
                                    className={`${cellClass} [container-type:size] ${liveMatches.length > 1 ? 'cursor-pointer transition-transform hover:scale-[1.01]' : ''}`}
                                    title={liveMatches.length > 1 ? 'Click to view this match full-screen' : undefined}
                                >
                                    <BroadcastMatchCard match={m} tournament={tournament} theme={theme} />
                                </div>
                            ))}
                        </motion.div>
                ) : activeMatch ? (
                    <div className="h-full flex flex-col items-center justify-center gap-[2vh]">
                        {liveMatches.length > 1 && (
                            <button
                                onClick={() => setSelectedMatchId('ALL')}
                                className="self-start flex items-center gap-2 text-sm font-bold uppercase tracking-widest border rounded-full px-4 py-2 transition-opacity hover:opacity-80 shrink-0 cursor-pointer"
                                style={chipStyle}
                            >
                                <ChevronLeft size={14} /> All {liveMatches.length} Live Matches
                            </button>
                        )}
                        <div className="w-full max-w-[1500px] aspect-[2.6/1] md:aspect-auto md:h-[68%] [container-type:size]">
                            <BroadcastMatchCard match={activeMatch} tournament={tournament} theme={theme} />
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                        <Tv size={44} style={{ color: theme.pageMuted }} />
                        <div className="font-bold uppercase tracking-[0.25em] text-[clamp(16px,3vh,36px)]">
                            No live matches right now
                        </div>
                        <div className="font-bold uppercase tracking-[0.2em] text-[clamp(11px,1.6vh,18px)]" style={{ color: theme.pageMuted }}>
                            Scores appear here as soon as a referee starts a match
                        </div>
                    </div>
                )}
            </main>

            {!sponsorsLoaded ? (
                // Hold the strip's space until we know whether there are sponsors,
                // so the ticker doesn't flash before the logos arrive.
                <div className="relative z-10 shrink-0 h-[9vh] min-h-[48px]" />
            ) : stripSponsors.length > 0 ? (
                <BroadcastSponsorStrip sponsors={stripSponsors} theme={theme} />
            ) : (
                <BroadcastTicker tournament={tournament} liveMatches={liveMatches} allMatches={globalMatches} theme={theme} />
            )}
        </div>,
        document.body
    );
};

const BroadcastSponsorStrip = ({ sponsors, theme }: { sponsors: any[]; theme: BroadcastPalette }) => {
    const ordered = sortSponsors(sponsors);
    // Up to 6 logos sit static and evenly spaced; more scroll as a slider
    // (list doubled for a seamless loop).
    const scroll = ordered.length > 6;
    const items = scroll ? [...ordered, ...ordered] : ordered;
    return (
        <footer
            className="relative z-10 shrink-0 h-[9vh] min-h-[48px] rounded-[1vh] overflow-hidden flex items-center"
            style={{ background: theme.stripBg, border: `1px solid ${theme.stripBorder}`, boxShadow: theme.cardShadow.replace(/cqh/g, 'vh') }}
        >
            <div className={scroll ? 'flex items-center h-full w-max animate-marquee' : 'flex items-center justify-around h-full w-full px-[2%]'}>
                {items.map((s, i) => (
                    <img
                        key={`${s.id}-${i}`}
                        src={s.logo}
                        alt={s.name || 'Sponsor'}
                        className={`h-[62%] w-auto max-w-[200px] object-contain ${scroll ? 'mx-[2.5vw]' : 'mx-2'}`}
                    />
                ))}
            </div>
        </footer>
    );
};

const BroadcastTicker = ({ tournament, liveMatches, allMatches, theme }: { tournament: Tournament; liveMatches: Match[]; allMatches: Match[]; theme: BroadcastPalette }) => {
    const teamName = (m: any, side: 1 | 2) => {
        const t = tournament.teams?.find((t: any) => t.id === (side === 1 ? m.team1Id : m.team2Id));
        return t?.name || (side === 1 ? m.team1Name : m.team2Name) || `Team ${side}`;
    };
    // Americano formats show the points total; padel formats show sets won.
    const tally = (m: any) => {
        const s = m.score || {};
        return isPointsScoredFormat(getActiveFormat(tournament, m.categoryId))
            ? `${s.p1Games ?? 0}-${s.p2Games ?? 0}`
            : `${s.p1Sets ?? 0}-${s.p2Sets ?? 0}`;
    };
    const events: string[] = [];
    liveMatches.forEach((m: any) => {
        events.push(`${m.courtName || m.court || 'Court'} • ${teamName(m, 1)} ${tally(m)} ${teamName(m, 2)}`);
    });
    allMatches.filter(isMatchFinished).slice(0, 5).forEach((m: any) => {
        const winner = m.winnerTeamId === m.team1Id ? teamName(m, 1) : m.winnerTeamId === m.team2Id ? teamName(m, 2) : null;
        events.push(`Result • ${teamName(m, 1)} vs ${teamName(m, 2)}${winner ? ` • Winner: ${winner}` : ''} (${tally(m)})`);
    });
    if (events.length === 0) {
        events.push(`${tournament.name}${tournament.venue ? ` • Live from ${tournament.venue}` : ''} • Streaming live on Matchup`);
    }
    return (
        <footer
            className="relative z-10 shrink-0 h-[6.5vh] min-h-[40px] rounded-[1vh] overflow-hidden flex items-center"
            style={{ background: theme.stripBg, border: `1px solid ${theme.stripBorder}` }}
        >
            <div className="h-full flex items-center px-[1.5vw] text-white font-bold uppercase tracking-widest italic shrink-0 text-[clamp(12px,2vh,24px)]" style={{ background: theme.tickerLabelBg }}>
                Live Updates
            </div>
            <div className="flex-1 overflow-hidden whitespace-nowrap fade-edges">
                <div className="inline-block animate-marquee">
                    {[...events, ...events].map((evt, j) => (
                        <span key={j} className="mx-[2.5vw] font-bold uppercase text-[clamp(12px,2.1vh,26px)]" style={{ color: theme.tickerText }}>{evt}</span>
                    ))}
                </div>
            </div>
        </footer>
    );
};

const BroadcastMatchCard = ({ match: initialMatch, tournament, theme }: { match: Match; tournament: Tournament; theme: BroadcastPalette }) => {
    const { matchData } = useMatchResult(initialMatch.id);
    const match: any = matchData || initialMatch;

    const teams = tournament.teams || [];
    const t1: any = teams.find((t: any) => t.id === match.team1Id);
    const t2: any = teams.find((t: any) => t.id === match.team2Id);
    const category = tournament.categories?.find((c: any) => c.id === match.categoryId);

    const [displayScore, setDisplayScore] = useState(match.score);
    const [flashOverlayTitle, setFlashOverlayTitle] = useState<string | null>(null);
    const [flashOverlaySubtitle, setFlashOverlaySubtitle] = useState<string | null>(null);
    const [lastHistoryLength, setLastHistoryLength] = useState(0);

    const effectiveHistory = getEffectiveEvents(match.score?.history || []);
    const finished = isMatchFinished(match);

    useEffect(() => {
        if (finished) {
            setDisplayScore(match.score);
            return;
        }
        // On a new point, flash what happened first, then reveal the new score.
        if (effectiveHistory.length > lastHistoryLength && lastHistoryLength > 0) {
            const ev = effectiveHistory[effectiveHistory.length - 1];
            if (ev && (ev.startsWith('T1') || ev.startsWith('T2'))) {
                const parts = ev.split('|');
                const team = parts[0] === 'T1' ? t1 : t2;
                const player = parseInt(parts[2] || '1') === 1 ? team?.player1?.name : team?.player2?.name;
                setFlashOverlayTitle(describePoint(parts[4], parts[3]));
                setFlashOverlaySubtitle(player || team?.name || parts[0]);
                setTimeout(() => setDisplayScore(match.score), 1000);
                setTimeout(() => {
                    setFlashOverlayTitle(null);
                    setFlashOverlaySubtitle(null);
                }, 3000);
            } else {
                setDisplayScore(match.score);
            }
        } else {
            setDisplayScore(match.score);
        }
        setLastHistoryLength(effectiveHistory.length);
    }, [effectiveHistory.length, match.score, match.status]);

    const score: any = displayScore || { p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0, p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [] };
    const p1SetScores: number[] = score.p1SetScores || [];
    const p2SetScores: number[] = score.p2SetScores || [];
    const doneSets = Math.min(p1SetScores.length, p2SetScores.length);
    const setInProgress = !finished && !score._isSetCompleted;

    // Americano-style matches are one running points total: no set columns,
    // the total sits in the score box (and stays there once the match ends).
    // Decided by the format, not by score fields: the referee scorer used to
    // write americanoMode into every match, which made normal padel matches
    // show their games in the score box instead of 15/30/40.
    const isPointsMatch = isPointsScoredFormat(getActiveFormat(tournament, match.categoryId));
    const pointsTotal = (side: 1 | 2) => String((side === 1 ? score.p1Games : score.p2Games) ?? 0);

    // S1-S3: finished sets, then the set in progress, then dashes.
    const setCells = (side: 1 | 2) => isPointsMatch ? [] : [0, 1, 2].map(i => {
        if (i < doneSets) {
            const mine = side === 1 ? p1SetScores[i] : p2SetScores[i];
            const theirs = side === 1 ? p2SetScores[i] : p1SetScores[i];
            return { value: String(mine), state: mine > theirs ? 'won' : 'lost' };
        }
        if (i === doneSets && setInProgress) {
            return { value: String((side === 1 ? score.p1Games : score.p2Games) ?? 0), state: 'current' };
        }
        // Completed match whose set history was never recorded: show the games.
        if (i === 0 && finished && doneSets === 0) {
            return { value: String((side === 1 ? score.p1Games : score.p2Games) ?? 0), state: 'won' };
        }
        return { value: '-', state: 'empty' };
    });

    const points = (v: any) => (v === undefined || v === null || String(v) === '0' ? '00' : String(v));

    const server = String(match.score?.server || '').toLowerCase();
    const servingSlot = finished ? null : ({ p1: [1, 0], p2: [1, 1], p3: [2, 0], p4: [2, 1] } as Record<string, number[]>)[server] || null;

    const showFlags = !!tournament.showNationFlags;
    // nameDisplay 'team' shows the team name instead of the two players.
    const playersOf = (t: any) => tournament.nameDisplay === 'team' && t?.name ? [] : [t?.player1, t?.player2]
        .filter(p => p?.name && String(p.name).toUpperCase() !== 'N/A')
        .map(p => ({ name: formatBroadcastPlayerName(p?.name), country: showFlags ? p?.country : undefined }))
        .filter(p => p.name);
    const teamLabel = (t: any, fallback?: string) => formatCleanName(t?.name || fallback).toUpperCase() || 'TBA';

    const live = isMatchLive(match);
    const statusLabel = finished ? 'Completed' : live ? 'Live' : 'Upcoming';
    const roundLabel = [match.roundName, category?.name].filter(Boolean).join(' - ');
    const courtLabel = match.courtName || match.court || '';

    return (
        <div
            className="relative h-full w-full flex flex-col overflow-hidden"
            style={{ borderRadius: '1.4cqh', boxShadow: theme.cardShadow, border: theme.cardBorder, fontFamily: FIP_FONT }}
        >
            {theme.cardAccent && (
                <div className="absolute left-0 top-0 bottom-0 z-10" style={{ width: 'min(1cqh, 0.5cqw)', background: theme.cardAccent }} />
            )}
            {theme.cardTopAccent && (
                <div className="shrink-0" style={{ height: 'min(1cqh, 0.45cqw)', background: theme.cardTopAccent }} />
            )}
            <div
                className="grid items-center shrink-0 font-bold uppercase tracking-wider"
                style={{ gridTemplateColumns: isPointsMatch ? FIP_COLS_POINTS : FIP_COLS, height: '11cqh', fontSize: 'min(6.4cqh, 2.6cqw)', background: theme.headBg, color: theme.headText }}
            >
                <span className="pl-[3cqw]">Players</span>
                {!isPointsMatch && <span className="text-center">S1</span>}
                {!isPointsMatch && <span className="text-center">S2</span>}
                {!isPointsMatch && <span className="text-center">S3</span>}
                <span className="text-center pr-[1.6cqw]">{isPointsMatch ? 'Points' : 'Score'}</span>
            </div>

            <div className="flex-1 min-h-0 flex flex-col" style={{ padding: '0.8cqh 0.6cqw', background: theme.bodyBg }}>
                <BroadcastTeamRow
                    theme={theme}
                    players={playersOf(t1)}
                    fallback={teamLabel(t1, match.team1Name)}
                    sets={setCells(1)}
                    points={isPointsMatch ? pointsTotal(1) : finished ? '' : points(score.p1Points)}
                    servingIdx={servingSlot && servingSlot[0] === 1 ? servingSlot[1] : null}
                    isWinner={finished && !!match.winnerTeamId && match.winnerTeamId === match.team1Id}
                />
                <div className="shrink-0 mx-[2cqw]" style={{ height: 1, background: theme.divider }} />
                <BroadcastTeamRow
                    theme={theme}
                    players={playersOf(t2)}
                    fallback={teamLabel(t2, match.team2Name)}
                    sets={setCells(2)}
                    points={isPointsMatch ? pointsTotal(2) : finished ? '' : points(score.p2Points)}
                    servingIdx={servingSlot && servingSlot[0] === 2 ? servingSlot[1] : null}
                    isWinner={finished && !!match.winnerTeamId && match.winnerTeamId === match.team2Id}
                />
            </div>

            <div
                className="grid grid-cols-[1fr_auto_1fr] items-center shrink-0 font-bold uppercase tracking-wider"
                style={{ height: '13cqh', fontSize: 'min(6.4cqh, 2.6cqw)', gap: '2cqw', padding: '0 1.6cqw', background: theme.footBg, color: theme.footText }}
            >
                <span
                    className="justify-self-start inline-flex items-center"
                    style={{ gap: '0.8cqw', padding: '0.7cqh 1.4cqw', borderRadius: '0.7cqh', background: live ? 'rgba(255,59,59,0.18)' : theme.statusBg }}
                >
                    {live && <span className="rounded-full bg-[#ff3b3b] animate-pulse" style={{ width: 'min(2.4cqh, 1cqw)', height: 'min(2.4cqh, 1cqw)' }} />}
                    {statusLabel}
                </span>
                <span className="text-center truncate">{courtLabel}</span>
                {roundLabel ? (
                    <span className="justify-self-end truncate max-w-full" style={{ padding: '0.7cqh 1.4cqw', borderRadius: '0.7cqh', background: theme.roundBg, color: theme.roundText }}>
                        {roundLabel}
                    </span>
                ) : <span />}
            </div>

            <AnimatePresence>
                {flashOverlayTitle && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center pointer-events-none backdrop-blur-sm"
                        style={{ background: theme.flashBg, color: theme.flashText, padding: '0 4cqw' }}
                    >
                        <span className="uppercase font-bold opacity-60 truncate max-w-full" style={{ fontSize: 'min(6cqh, 2.6cqw)', letterSpacing: '0.25em' }}>
                            {flashOverlaySubtitle}
                        </span>
                        <motion.span
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="italic font-bold uppercase leading-none"
                            style={{ fontSize: 'min(20cqh, 8cqw)' }}
                        >
                            {flashOverlayTitle}
                        </motion.span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const BroadcastTeamRow = ({ theme, players, fallback, sets, points, servingIdx, isWinner }: {
    theme: BroadcastPalette;
    players: { name: string; country?: string }[];
    fallback: string;
    sets: { value: string; state: string }[];
    points: string;
    servingIdx: number | null;
    isWinner: boolean;
}) => {
    const nameStyle = { fontSize: 'min(14cqh, 6.4cqw)', color: theme.nameText };
    const flagStyle = { height: 'min(10cqh, 4.4cqw)', width: 'min(15cqh, 6.6cqw)', borderRadius: '0.5cqh', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' };
    const serveDot = (
        <span
            className="shrink-0 rounded-full"
            style={{ width: 'min(3cqh, 1.4cqw)', height: 'min(3cqh, 1.4cqw)', background: theme.serveDot, boxShadow: `0 0 0.8cqh ${theme.serveDot}` }}
        />
    );
    const trophy = <Trophy className="shrink-0 text-amber-500" style={{ width: 'min(8cqh, 3.4cqw)', height: 'min(8cqh, 3.4cqw)' }} />;
    return (
        <div className="flex-1 min-h-0 grid items-center" style={{ gridTemplateColumns: sets.length ? FIP_COLS : FIP_COLS_POINTS }}>
            <div className="min-w-0 flex flex-col justify-center" style={{ paddingLeft: '2.4cqw', gap: '0.8cqh' }}>
                {players.length > 0 ? players.map((p, i) => (
                    <div key={i} className="flex items-center min-w-0" style={{ gap: '1.2cqw' }}>
                        {p.country && <CountryFlag code={p.country} style={flagStyle} />}
                        <span className="truncate font-bold uppercase leading-[0.95]" style={nameStyle}>{p.name}</span>
                        {servingIdx === i && serveDot}
                        {isWinner && i === 0 && trophy}
                    </div>
                )) : (
                    <div className="flex items-center min-w-0" style={{ gap: '1.2cqw' }}>
                        <span className="line-clamp-2 font-bold uppercase leading-[0.95]" style={nameStyle}>{fallback}</span>
                        {servingIdx !== null && serveDot}
                        {isWinner && trophy}
                    </div>
                )}
            </div>
            {sets.map((cell, i) => (
                <div
                    key={i}
                    className="text-center font-bold tabular-nums leading-none"
                    style={{
                        fontSize: 'min(17cqh, 7cqw)',
                        color: cell.state === 'current' ? theme.setCurrent : theme.setText,
                        opacity: cell.state === 'lost' ? 0.45 : cell.state === 'empty' ? 0.3 : 1,
                    }}
                >
                    {cell.value}
                </div>
            ))}
            <div className="h-full" style={{ padding: '1.4cqh 1.2cqw 1.4cqh 0.4cqw' }}>
                <div
                    className="h-full flex items-center justify-center font-bold tabular-nums leading-none"
                    style={{
                        fontSize: 'min(22cqh, 9cqw)',
                        borderRadius: '0.8cqh',
                        background: theme.scoreBg,
                        color: theme.scoreText,
                        boxShadow: 'inset 0 -0.7cqh 0 rgba(0,0,0,0.18)',
                    }}
                >
                    {points}
                </div>
            </div>
        </div>
    );
};
const ExpandableSection = ({ 
    title, 
    sectionMatches, 
    defaultExpanded = false, 
    teams, 
    tournament 
}: { 
    title: string; 
    sectionMatches: Match[]; 
    defaultExpanded?: boolean; 
    teams: Team[]; 
    tournament?: any; 
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    
    return (
        <div className="mb-4 overflow-hidden rounded-2xl shadow-xl">
           <button onClick={() => setExpanded(prev => !prev)} className="w-full flex items-center justify-between p-4 md:px-6 bg-[#4D78FF] font-black text-xl text-white transition-colors hover:bg-blue-600">
               <div className="flex items-center gap-3">
                   <span className="tracking-[0.15em] italic uppercase">{title}</span>
                   <span className="text-[10px] sm:text-xs font-bold text-[#4D78FF] bg-white px-2 py-0.5 rounded-full shadow">{sectionMatches.length} matches</span>
               </div>
               <ChevronDown size={24} className={`transform transition-transform text-white ${expanded ? 'rotate-180' : ''}`} />
           </button>
           {expanded && (
               <div className="p-3 sm:p-5 bg-black/40 border-x border-b border-[#4D78FF]/20 rounded-b-2xl">
                   {sectionMatches.length === 0 ? (
                       <div className="text-content-muted text-sm italic py-4 text-center font-medium">No matches found for this stage yet.</div>
                   ) : (
                       <div className="space-y-4">
                           {sectionMatches.map((m: Match) => (
                               <MatchResultCard key={m.id} match={m} teams={teams} tournament={tournament} />
                           ))}
                       </div>
                   )}
               </div>
           )}
        </div>
    );
};

const isGroupMatchHelper = (m: Match) => {
    const stage = m.stage?.toUpperCase();
    if (stage === 'GROUP') return true;
    if (m.roundName && m.roundName.toUpperCase().includes('GROUP')) return true;
    return false;
};

const getGroupIdentifierHelper = (m: Match) => {
    if (m.group && m.group.trim()) return m.group.trim().toUpperCase();
    if (m.roundName) {
        const match = m.roundName.match(/Group\s+([A-Za-z0-9]+)/i);
        if (match && match[1]) return match[1].toUpperCase();
    }
    return 'General';
};

const sortMatchesAscendingHelper = (matchesList: Match[]) => {
    return [...matchesList].sort((a, b) => {
        const isGroupA = isGroupMatchHelper(a);
        const isGroupB = isGroupMatchHelper(b);
        
        if (isGroupA && isGroupB) {
            const groupLetterA = getGroupIdentifierHelper(a);
            const groupLetterB = getGroupIdentifierHelper(b);
            const groupCompare = groupLetterA.localeCompare(groupLetterB);
            if (groupCompare !== 0) return groupCompare;
            
            const timeA = getMatchTimestamp(a);
            const timeB = getMatchTimestamp(b);
            return timeA - timeB;
        } else if (!isGroupA && !isGroupB) {
            if (a.round !== b.round) {
                return (a.round || 0) - (b.round || 0);
            }
            const timeA = getMatchTimestamp(a);
            const timeB = getMatchTimestamp(b);
            return timeA - timeB;
        }
        
        return isGroupA ? -1 : 1;
    });
};

const ResultsTable = ({ title, icon, matchesToRender, teams }: { title: string; icon: React.ReactNode; matchesToRender: Match[]; teams: Team[] }) => {
    if (matchesToRender.length === 0) return null;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
                {icon}
                <h4 className="text-sm font-black text-white uppercase tracking-widest">{title}</h4>
                <span className="text-[10px] font-bold text-content-muted bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">
                    {matchesToRender.length} {matchesToRender.length === 1 ? 'match' : 'matches'}
                </span>
            </div>
            <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden w-full shadow-2xl">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left font-mono min-w-[800px]">
                        <thead className="bg-[#111111] text-[10px] text-content-muted font-black uppercase tracking-widest border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4">Stage / Round</th>
                                <th className="px-6 py-4">Winner</th>
                                <th className="px-6 py-4 text-center">Score</th>
                                <th className="px-6 py-4">Opponent</th>
                                <th className="px-6 py-4 text-center">Court</th>
                                <th className="px-6 py-4 text-right">Completed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs text-white">
                            {sortMatchesAscendingHelper(matchesToRender).map((m) => {
                                const t1 = teams.find(t => t.id === m.team1Id);
                                const t2 = teams.find(t => t.id === m.team2Id);
                                const isT1Winner = m.winnerTeamId === m.team1Id;
                                
                                const winner = isT1Winner ? t1 : t2;
                                const loser = isT1Winner ? t2 : t1;
                                
                                const winnerName = winner?.name || (isT1Winner ? m.team1Name : m.team2Name) || 'TBA';
                                const winnerPlayers = winner ? [winner.player1?.name, winner.player2?.name].filter(n => n && n.trim()).join(' & ') : '';
                                
                                const loserName = loser?.name || (!isT1Winner ? m.team1Name : m.team2Name) || 'TBA';
                                const loserPlayers = loser ? [loser.player1?.name, loser.player2?.name].filter(n => n && n.trim()).join(' & ') : '';
                                
                                const p1SetScores = m.score?.p1SetScores || [];
                                const p2SetScores = m.score?.p2SetScores || [];
                                const p1Games = m.score?.p1Games ?? 0;
                                const p2Games = m.score?.p2Games ?? 0;
                                let p1Sets = m.score?.p1Sets || 0;
                                let p2Sets = m.score?.p2Sets || 0;

                                if (p1SetScores.length > 0 && p1Sets === 0 && p2Sets === 0) {
                                    p1SetScores.forEach((s: number, i: number) => {
                                        const os = p2SetScores[i] || 0;
                                        if (s > os) p1Sets++; else if (os > s) p2Sets++;
                                    });
                                }

                                const isSingleGameFormat = (p1Sets === 0 && p2Sets === 0 && (p1Games > 0 || p2Games > 0)) || (p1SetScores.length === 1 && (p1SetScores[0] > 1 || p2SetScores[0] > 1));
                                const winSets = isT1Winner ? (p1Sets || 1) : (p2Sets || 0);
                                const loseSets = isT1Winner ? (p2Sets || 0) : (p1Sets || 1);
                                
                                return (
                                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors border-b border-white/5">
                                        <td className="px-6 py-4">
                                            <div className="text-white font-black text-xs uppercase tracking-wider">{m.roundName || 'Match'}</div>
                                            <div className="text-[9px] text-content-muted font-black uppercase tracking-widest mt-0.5">{m.stage || 'PLAYOFF'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Trophy size={14} className="text-[#E65C31] fill-amber-400 shrink-0" />
                                                <span className="font-black text-sm text-white truncate max-w-[150px]">{winnerName}</span>
                                            </div>
                                            {winnerPlayers && (
                                                <div className="text-[10px] text-content-muted mt-0.5 truncate max-w-[150px]">{winnerPlayers}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {isSingleGameFormat ? (
                                                <span className="inline-flex items-center bg-brand/10 border border-brand/20 text-brand px-3 py-1 rounded-lg text-xs font-mono font-bold">
                                                    {isT1Winner ? `${p1Games || p1SetScores[0] || 1}-${p2Games || p2SetScores[0] || 0}` : `${p2Games || p2SetScores[0] || 1}-${p1Games || p1SetScores[0] || 0}`}
                                                </span>
                                            ) : p1SetScores.length > 0 ? (
                                                <div className="flex gap-1 justify-center">
                                                    {p1SetScores.map((s, i) => {
                                                        const winSet = isT1Winner ? s : p2SetScores[i];
                                                        const loseSet = isT1Winner ? p2SetScores[i] : s;
                                                        return (
                                                            <span key={i} className="inline-flex items-center bg-black/40 border border-white/10 text-white px-2 py-0.5 rounded text-xs font-mono font-bold">
                                                                {winSet}-{loseSet}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center bg-[#4D78FF]/10 border border-[#4D78FF]/20 text-[#4D78FF] px-3 py-1 rounded-lg text-xs font-mono font-bold">
                                                    {`${winSets}-${loseSets}`}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-xs text-gray-400 truncate max-w-[150px]">{loserName}</div>
                                            {loserPlayers && (
                                                <div className="text-[10px] text-content-muted mt-0.5 truncate max-w-[150px]">{loserPlayers}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-white/5 text-gray-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/5">
                                                {m.court}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-gray-400 text-xs font-medium">
                                                {formatFullDateOnly(m.scheduledTime)}
                                            </div>
                                            <div className="text-[9px] text-content-muted mt-0.5">
                                                {m.scheduledTime ? formatTimeOnly(m.scheduledTime) : ''}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const SpectatorResults = ({ matches, teams, tournament }: { matches: Match[]; teams: Team[]; tournament?: any }) => {
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
    const [activeStageTab, setActiveStageTab] = useState<'all' | 'knockout' | 'group'>('all');
    const filteredMatches = matches.filter(m => (m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED' || String(m.status).toUpperCase() === 'COMPLETED') || !!m.winnerTeamId);

    const isGroupMatch = (m: Match) => isGroupMatchHelper(m);
    const isKnockoutMatch = (m: Match) => !isGroupMatch(m);

    const groupMatches = filteredMatches.filter(isGroupMatch);
    const playoffMatches = filteredMatches.filter(isKnockoutMatch);
    
    const playoffByRound: Record<string, Match[]> = {};
    playoffMatches.forEach(m => {
        const key = m.roundName || `Round ${m.round}`;
        if (!playoffByRound[key]) playoffByRound[key] = [];
        playoffByRound[key].push(m);
    });
    
    // Sort ascending by round (Round of 12 / Round 1 first, then Round of 8, Semis, Finals)
    const playoffRounds = Object.entries(playoffByRound).sort((a, b) => {
        const roundA = a[1][0]?.round || 0;
        const roundB = b[1][0]?.round || 0;
        return roundA - roundB; 
    });

    const groupMatchesByGroup: Record<string, Match[]> = {};
    groupMatches.forEach(m => {
        const key = `Group ${getGroupIdentifierHelper(m)}`;
        if (!groupMatchesByGroup[key]) groupMatchesByGroup[key] = [];
        groupMatchesByGroup[key].push(m);
    });
    
    // Sort group rounds ascending by Group name, and sort matches inside them chronologically ascending (earliest first)
    const groupRounds = Object.entries(groupMatchesByGroup)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, sectionMatches]) => [key, [...sectionMatches].sort((ma, mb) => getMatchTimestamp(ma) - getMatchTimestamp(mb))] as const);

    const matchesToDisplay = filteredMatches.filter(m => {
        if (activeStageTab === 'knockout') return isKnockoutMatch(m);
        if (activeStageTab === 'group') return isGroupMatch(m);
        return true;
    });

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-[0.15em]">
                        <Trophy className="text-[#4D78FF]" size={24} /> Results Archive
                    </h3>
                    <p className="text-content-secondary text-sm">View completed match records and scores.</p>
                </div>
                {filteredMatches.length > 0 && (
                    <div className="flex bg-[#0D0D0D] border border-white/5 rounded-xl p-1 shrink-0 self-start sm:self-center">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'table'
                                    ? 'bg-[#4D78FF] text-white shadow-lg shadow-blue-500/10'
                                    : 'text-content-secondary hover:text-white'
                            }`}
                        >
                            <List size={14} /> Table View
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'cards'
                                    ? 'bg-[#4D78FF] text-white shadow-lg shadow-blue-500/10'
                                    : 'text-content-secondary hover:text-white'
                            }`}
                        >
                            <LayoutGrid size={14} /> Cards View
                        </button>
                    </div>
                )}
            </div>

            {filteredMatches.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                    <button
                        onClick={() => setActiveStageTab('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                            activeStageTab === 'all'
                                ? 'bg-[#4D78FF] text-white border-[#4D78FF] shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                        }`}
                    >
                        All Stages ({filteredMatches.length})
                    </button>
                    <button
                        onClick={() => setActiveStageTab('knockout')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                            activeStageTab === 'knockout'
                                ? 'bg-[#4D78FF] text-white border-[#4D78FF] shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                        }`}
                    >
                        🏆 Knockout Stage ({playoffMatches.length})
                    </button>
                    <button
                        onClick={() => setActiveStageTab('group')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                            activeStageTab === 'group'
                                ? 'bg-[#4D78FF] text-white border-[#4D78FF] shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                        }`}
                    >
                        👥 Group Stage ({groupMatches.length})
                    </button>
                </div>
            )}

            {filteredMatches.length > 0 && viewMode === 'table' && (
                <div className="space-y-8">
                    {(activeStageTab === 'all' || activeStageTab === 'knockout') && playoffMatches.length > 0 && (
                        <ResultsTable 
                            title="Knockout & Playoff Stage Results" 
                            icon={<Trophy className="text-[#4D78FF]" size={16} />} 
                            matchesToRender={playoffMatches} 
                            teams={teams}
                        />
                    )}
                    {(activeStageTab === 'all' || activeStageTab === 'group') && groupMatches.length > 0 && (
                        <ResultsTable 
                            title="Group Stage Results" 
                            icon={<Users className="text-[#4D78FF]" size={16} />} 
                            matchesToRender={groupMatches} 
                            teams={teams}
                        />
                    )}
                </div>
            )}

            {filteredMatches.length > 0 && viewMode === 'cards' && (
                <div className="space-y-8">
                    {(activeStageTab === 'all' || activeStageTab === 'knockout') && playoffRounds.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <Trophy className="text-[#4D78FF]" size={16} />
                                <h4 className="text-sm font-black text-white uppercase tracking-widest">Knockout Stage</h4>
                            </div>
                            {playoffRounds.map(([roundName, matches], idx) => (
                                <ExpandableSection key={roundName} title={roundName} sectionMatches={[...matches].sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b))} defaultExpanded={idx === 0} teams={teams} tournament={tournament} />
                            ))}
                        </div>
                    )}

                    {(activeStageTab === 'all' || activeStageTab === 'group') && groupRounds.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <Users className="text-[#4D78FF]" size={16} />
                                <h4 className="text-sm font-black text-white uppercase tracking-widest">Group Stage</h4>
                            </div>
                            {groupRounds.map(([groupName, matches], idx) => (
                                <ExpandableSection key={groupName} title={groupName} sectionMatches={matches} defaultExpanded={playoffRounds.length === 0 && idx === 0} teams={teams} tournament={tournament} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {matchesToDisplay.length === 0 && filteredMatches.length > 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center bg-surface-panel rounded-2xl border border-white/5 border-dashed">
                    <History size={48} className="text-white/10 mb-4" />
                    <div className="text-lg font-bold text-white uppercase italic tracking-[0.15em]">No Matches In This Stage</div>
                    <div className="text-content-muted text-sm mt-1 max-w-sm mx-auto">
                        No completed matches are recorded for the selected stage.
                    </div>
                </div>
            )}

            {filteredMatches.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center bg-surface-panel rounded-2xl border border-white/5 border-dashed">
                    <History size={48} className="text-white/10 mb-4" />
                    <div className="text-lg font-bold text-white uppercase italic tracking-[0.15em]">No Results Yet</div>
                    <div className="text-content-muted text-sm mt-1 max-w-sm mx-auto">
                        Once matches are completed and scored, they will appear here grouped by stage.
                    </div>
                </div>
            )}
        </div>
    );
};


export const LiveMatchesTable = ({ matches, teams, tournament }: { matches: Match[]; teams: Team[]; tournament?: any }) => {
    const [selectedLiveMatch, setSelectedLiveMatch] = useState<Match | null>(null);
    const [livePage, setLivePage] = useState(0);
    const liveTotalPages = Math.max(1, Math.ceil(matches.length / LIVE_PAGE_SIZE));
    const liveSafePage = Math.min(livePage, liveTotalPages - 1);
    const pagedMatches = matches.slice(liveSafePage * LIVE_PAGE_SIZE, (liveSafePage + 1) * LIVE_PAGE_SIZE);
    
    // Keep state updated in real-time if a match document is edited
    const activeModalMatch = selectedLiveMatch 
        ? (matches.find(m => m.id === selectedLiveMatch.id) || selectedLiveMatch)
        : null;

            const getTeamNamesAndPlayers = (teamId?: string, fallbackTeamName?: string, fallbackPlayerNames?: string) => {
        const t = teams.find(team => team.id === teamId);
        
        let player1 = '';
        let player2 = '';
        let teamName = fallbackTeamName || 'TBD';

        if (t) {
            teamName = t.name || fallbackTeamName || 'TBD';
            if (t.player1?.name || (t.player1 as any)?.fullName) {
                player1 = t.player1?.name || (t.player1 as any)?.fullName;
                player2 = t.player2?.name || (t.player2 as any)?.fullName || '';
            } else {
                if (t.name && t.name.includes(' / ')) {
                    const split = t.name.split(' / ');
                    player1 = split[0];
                    player2 = split[1];
                } else if (t.name) {
                    player1 = t.name;
                    player2 = '';
                } else {
                    player1 = 'TBD';
                }
            }
        } else {
             if (fallbackPlayerNames) {
                 const split = fallbackPlayerNames.split(' / ');
                 if (split.length >= 2) {
                     player1 = split[0];
                     player2 = split[1];
                 } else {
                     player1 = fallbackPlayerNames;
                     player2 = '';
                 }
             } else if (fallbackTeamName) {
                 if (fallbackTeamName.includes(' / ')) {
                     const split = fallbackTeamName.split(' / ');
                     player1 = split[0];
                     player2 = split[1];
                 } else {
                     player1 = fallbackTeamName;
                     player2 = '';
                 }
             } else {
                 player1 = 'TBD';
             }
        }
        
        if (teamName === 'TBD' && player1 !== 'TBD') {
            teamName = player2 ? `${player1.split(' ')[0]} & ${player2.split(' ')[0]}` : player1;
        }
        
        return { teamName, player1: player1 || 'TBD', player2 };
    };

    // FIX (client feedback: "Points & Action History" was showing raw
    // internal event strings like "T2|1789408183828|2|winner|bandeja"
    // verbatim instead of readable text): this is the pipe-delimited
    // encoding MatchScoringSystem writes to score.history
    // (team|timestamp|playerIndex|tag|finisher). The formatted `timeline`
    // field this panel prefers isn't populated by the current scoring
    // flow, so it was always falling through to rendering that raw string
    // directly. Parses it the same way the broadcast ticker elsewhere in
    // this file already does, resolving real player names via
    // getTeamNamesAndPlayers instead of showing the raw encoding.
    const formatHistoryEntry = (raw: string, match: any): string => {
        if (raw.startsWith('START_SET_NORMAL') || raw.startsWith('START_SET_SUPER')) {
            return 'New set started';
        }
        const parts = raw.split('|');
        const type = parts[0];
        if (type !== 'T1' && type !== 'T2') return raw;

        const playerIdx = parseInt(parts[2] || '1');
        const tag = parts[3];
        const finisher = parts[4];

        const team = type === 'T1'
            ? getTeamNamesAndPlayers(match?.team1Id, match?.team1Name, match?.team1PlayerNames)
            : getTeamNamesAndPlayers(match?.team2Id, match?.team2Name, match?.team2PlayerNames);
        const who = (playerIdx === 1 ? team.player1 : team.player2) || team.teamName;

        let actionStr = 'Point won';
        if (finisher === 'smash') actionStr = 'Smash winner';
        else if (finisher === 'vibora') actionStr = 'Vibora winner';
        else if (finisher === 'drop' || finisher === 'drop shot') actionStr = 'Drop shot winner';
        else if (finisher === 'bandeja') actionStr = 'Bandeja winner';
        else if (finisher === 'volley') actionStr = 'Volley winner';
        else if (finisher === 'net') actionStr = 'Net error';
        else if (finisher === 'glass') actionStr = 'Glass error';
        else if (finisher === 'double fault') actionStr = 'Double fault';
        else if (finisher === 'grill') actionStr = 'Grill error';
        else if (tag === 'winner') actionStr = 'Winner';
        else if (tag === 'error') actionStr = 'Unforced error';

        return `${who} — ${actionStr}`;
    };

    return (
        <div className="w-full">
            <div className="flex flex-col gap-3">
                {pagedMatches.map(m => {
                    const t1TeamName = getTeamNamesAndPlayers(m.team1Id, m.team1Name, m.team1PlayerNames).teamName;
                    const t2TeamName = getTeamNamesAndPlayers(m.team2Id, m.team2Name, m.team2PlayerNames).teamName;
                    
                    const score: any = m.score || { p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0, p1Sets: 0, p2Sets: 0, currentSet: 1 };
                    
                    const isT1Serving = score.server === 'p1' || score.server === 'p2';
                    const isT2Serving = score.server === 'p3' || score.server === 'p4';

                    return (
                        <div 
                            key={m.id} 
                            onClick={() => setSelectedLiveMatch(m)}
                            className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden cursor-pointer hover:border-white/20 transition-all group shadow-lg"
                        >
                            <div className="flex items-stretch">
                                {/* Left Edge Accent */}
                                <div className="w-1.5 bg-[#4D78FF] opacity-50 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="flex-1 flex flex-col p-3 sm:p-5">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-accent-live animate-ping" />
                                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                                {m.court || 'MAIN COURT'}
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Set {score.currentSet || 1}</span>
                                    </div>

                                    {/* Stats Grid Header */}
                                    <div className="grid grid-cols-[1fr_30px_30px_40px] sm:grid-cols-[1fr_40px_40px_50px] gap-2 mb-2 text-[9px] sm:text-[10px] text-gray-500 font-black uppercase tracking-widest text-center border-b border-white/5 pb-2">
                                        <div className="text-left pl-4">Team</div>
                                        <div>Set</div>
                                        <div>Game</div>
                                        <div className="text-[#4D78FF]">Pts</div>
                                    </div>

                                    {/* Team 1 */}
                                    <div className="grid grid-cols-[1fr_30px_30px_40px] sm:grid-cols-[1fr_40px_40px_50px] gap-2 items-center mb-3">
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isT1Serving ? 'bg-[#E65C31] shadow-[0_0_6px_#E65C31]' : 'opacity-0'}`} />
                                            <div className="flex flex-col min-w-0 leading-tight">
                                                <span className="text-white font-black text-xs sm:text-sm uppercase tracking-wider truncate">{t1TeamName}</span>
                                            </div>
                                        </div>
                                        <div className="text-center font-mono font-bold text-gray-400 text-xs sm:text-sm">{score.p1Sets}</div>
                                        <div className="text-center font-mono font-bold text-white text-xs sm:text-sm">{score.p1Games}</div>
                                        <div className="text-center font-mono font-black text-[#4D78FF] text-sm sm:text-base">{score.p1Points === '0' ? '00' : score.p1Points}</div>
                                    </div>

                                    {/* Team 2 */}
                                    <div className="grid grid-cols-[1fr_30px_30px_40px] sm:grid-cols-[1fr_40px_40px_50px] gap-2 items-center">
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isT2Serving ? 'bg-[#E65C31] shadow-[0_0_6px_#E65C31]' : 'opacity-0'}`} />
                                            <div className="flex flex-col min-w-0 leading-tight">
                                                <span className="text-white font-black text-xs sm:text-sm uppercase tracking-wider truncate">{t2TeamName}</span>
                                            </div>
                                        </div>
                                        <div className="text-center font-mono font-bold text-gray-400 text-xs sm:text-sm">{score.p2Sets}</div>
                                        <div className="text-center font-mono font-bold text-white text-xs sm:text-sm">{score.p2Games}</div>
                                        <div className="text-center font-mono font-black text-[#4D78FF] text-sm sm:text-base">{score.p2Points === '0' ? '00' : score.p2Points}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <PaginationBar page={liveSafePage} totalPages={liveTotalPages} onChange={setLivePage} />
            {/* Interactive Court Detail / Detailed Scoreboard Overlay */}
            <AnimatePresence>
                {activeModalMatch && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="bg-[#0D0D0D] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col my-8"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#111111]">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-accent-live animate-ping" />
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#E65C31]">
                                        {activeModalMatch.court || 'Court In Progress'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedLiveMatch(null)}
                                    className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border-none cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Massive Live Scoreboard Card */}
                            <div className="p-6 flex flex-col gap-6">
                                <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                                    {/* Scoreboard Glow Base */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-[#4D78FF] to-transparent opacity-40" />
                                    
                                    <div className="flex items-center justify-between gap-4">
                                        {/* Team 1 Details */}
                                        <div className="flex-1 text-center space-y-2">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                <h3 className="text-white font-black text-base md:text-lg uppercase tracking-wider">
                                                    {getTeamNamesAndPlayers(activeModalMatch.team1Id, activeModalMatch.team1Name, activeModalMatch.team1PlayerNames).teamName}
                                                </h3>
                                                {(activeModalMatch.score?.server === 'p1' || activeModalMatch.score?.server === 'p2') && (
                                                    <span className="w-2 h-2 bg-[#E65C31] rounded-full shadow-[0_0_8px_#E65C31]" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                                {getTeamNamesAndPlayers(activeModalMatch.team1Id, activeModalMatch.team1Name, activeModalMatch.team1PlayerNames).player1}
                                            </p>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                                {getTeamNamesAndPlayers(activeModalMatch.team1Id, activeModalMatch.team1Name, activeModalMatch.team1PlayerNames).player2}
                                            </p>
                                        </div>

                                        {/* Giant Digital Center Score */}
                                        <div className="flex flex-col items-center justify-center bg-black border border-white/10 rounded-2xl px-6 py-4 min-w-[120px] shadow-2xl">
                                            <div className="flex items-center gap-3 font-mono">
                                                <span className="text-3xl md:text-4xl font-black text-[#4D78FF] tracking-widest">
                                                    {activeModalMatch.score?.p1Points === '0' ? '00' : activeModalMatch.score?.p1Points}
                                                </span>
                                                <span className="text-gray-600 font-black text-xl">-</span>
                                                <span className="text-3xl md:text-4xl font-black text-[#4D78FF] tracking-widest">
                                                    {activeModalMatch.score?.p2Points === '0' ? '00' : activeModalMatch.score?.p2Points}
                                                </span>
                                            </div>
                                            <div className="text-[10px] uppercase font-black tracking-widest text-gray-500 mt-2">
                                                Set {activeModalMatch.score?.currentSet || 1}
                                            </div>
                                        </div>

                                        {/* Team 2 Details */}
                                        <div className="flex-1 text-center space-y-2">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                {(activeModalMatch.score?.server === 'p3' || activeModalMatch.score?.server === 'p4') && (
                                                    <span className="w-2 h-2 bg-[#E65C31] rounded-full shadow-[0_0_8px_#E65C31]" />
                                                )}
                                                <h3 className="text-white font-black text-base md:text-lg uppercase tracking-wider">
                                                    {getTeamNamesAndPlayers(activeModalMatch.team2Id, activeModalMatch.team2Name, activeModalMatch.team2PlayerNames).teamName}
                                                </h3>
                                            </div>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                                {getTeamNamesAndPlayers(activeModalMatch.team2Id, activeModalMatch.team2Name, activeModalMatch.team2PlayerNames).player1}
                                            </p>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                                {getTeamNamesAndPlayers(activeModalMatch.team2Id, activeModalMatch.team2Name, activeModalMatch.team2PlayerNames).player2}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Set Scores breakdown */}
                                    <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-white/5 text-center text-xs">
                                        <div>
                                            <span className="text-gray-400 uppercase font-black tracking-wider block mb-1">Set History</span>
                                            <div className="flex items-center justify-center gap-2">
                                                {(activeModalMatch.score?.p1SetScores || []).map((sScore, idx) => (
                                                    <span key={idx} className="bg-white/5 font-black text-white px-2.5 py-1 rounded border border-white/5 font-mono">
                                                        {sScore}
                                                    </span>
                                                ))}
                                                {(activeModalMatch.score?.p1SetScores || []).length === 0 && (
                                                    <span className="text-gray-600 italic">No set data</span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 uppercase font-black tracking-wider block mb-1">Set History</span>
                                            <div className="flex items-center justify-center gap-2">
                                                {(activeModalMatch.score?.p2SetScores || []).map((sScore, idx) => (
                                                    <span key={idx} className="bg-white/5 font-black text-white px-2.5 py-1 rounded border border-white/5 font-mono">
                                                        {sScore}
                                                    </span>
                                                ))}
                                                {(activeModalMatch.score?.p2SetScores || []).length === 0 && (
                                                    <span className="text-gray-600 italic">No set data</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Chronological Events Timeline */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                                        <History size={14} className="text-[#4D78FF]" />
                                        <span>Points & Action History</span>
                                    </h4>

                                    <div className="max-h-[220px] overflow-y-auto pr-2 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10">
                                        {activeModalMatch.score?.timeline && activeModalMatch.score.timeline.length > 0 ? (
                                            [...activeModalMatch.score.timeline].reverse().map((evt: MatchEvent) => (
                                                <div key={evt.id} className="flex gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3 items-center">
                                                    <span className="text-[10px] font-bold font-mono text-gray-500 shrink-0">
                                                        {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Point'}
                                                    </span>
                                                    <div className="h-1.5 w-1.5 rounded-full bg-[#E65C31] shrink-0" />
                                                    <p className="text-xs text-white/90 font-medium leading-relaxed">
                                                        {evt.description}
                                                    </p>
                                                </div>
                                            ))
                                        ) : activeModalMatch.score?.history && activeModalMatch.score.history.length > 0 ? (
                                            [...activeModalMatch.score.history].reverse().map((desc, idx) => (
                                                <div key={idx} className="flex gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3 items-center">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-[#4D78FF] shrink-0" />
                                                    <p className="text-xs text-white/90 font-medium leading-relaxed">
                                                        {formatHistoryEntry(desc, activeModalMatch)}
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-10 text-center text-xs text-gray-500">
                                                Waiting for point logs to stream...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const SpectatorSchedule = ({ matches, teams, onSelectTab }: { matches: Match[]; teams: Team[]; onSelectTab: (tab: 'live' | 'timelines' | 'standings' | 'results' | 'schedule') => void }) => {
    // Upcoming matches are (status !== 'COMPLETED' && String(status).toUpperCase() !== 'FINISHED')
    const upcomingMatches = matches.filter(m => {
        const isCompleted = (m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED' || String(m.status).toUpperCase() === 'COMPLETED') || !!m.winnerTeamId;
        return !isCompleted;
    });

    const getTeamName = (teamId: string, fallbackName?: string) => {
        const t = teams.find(team => team.id === teamId);
        const getFirstName = (name?: string) => (name && name.trim()) ? name.trim().split(' ')[0] : '';
        let nm = t?.name || fallbackName || [getFirstName(t?.player1?.name), getFirstName(t?.player2?.name)].filter(n => n && n.trim()).join(' & ') || 'TBD';
        nm = nm.replace(/^&\s*/, '').replace(/\s*&$/, '').trim();
        return nm || 'TBD';
    };

    const sortedAll = [...upcomingMatches].sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));
    const hasGroups = sortedAll.some(m => !!m.group || (m.roundName && m.roundName.startsWith('Group ')));

    const renderCard = (m: Match) => {
        const t1 = getTeamName(m.team1Id, m.team1Name);
        const t2 = getTeamName(m.team2Id, m.team2Name);
        const isLive = (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'IN_PROGRESS' || String(m.status).toUpperCase() === 'LIVE') && !m.winnerTeamId;

        return (
            <Card 
                key={m.id} 
                variant="panel" 
                className={`p-4 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors group ${isLive ? 'border-[#E65C31]/50 bg-[#E65C31]/5 hover:border-[#E65C31] cursor-pointer' : ''}`}
                onClick={() => {
                    if (isLive) {
                        onSelectTab('live');
                    }
                }}
            >
                <div className="flex-1 w-full text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                        <span className="text-brand text-xs font-bold uppercase tracking-wider">{m.roundName}</span>
                        {isLive && (
                            <span className="bg-[#E65C31] text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">
                                LIVE NOW
                            </span>
                        )}
                    </div>
                    <div className="text-white font-medium text-lg flex items-center justify-center md:justify-start gap-3">
                        <span>{t1}</span>
                        <span className="text-content-muted text-sm">vs</span>
                        <span>{t2}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between w-full md:w-auto gap-4 text-sm text-content-secondary">
                    <div className="flex items-center gap-2 flex-1 md:flex-initial justify-center md:justify-start font-mono">
                        <Calendar size={14}/> {formatFullTime(m.scheduledTime)}
                    </div>
                    <Badge variant="neutral" className="font-mono">{m.court}</Badge>
                    {isLive && (
                        <div className="text-[10px] text-brand uppercase font-black tracking-widest hidden md:block group-hover:underline">
                            Watch Live →
                        </div>
                    )}
                </div>
            </Card>
        );
    };

    if (upcomingMatches.length === 0) {
        return (
            <div className="text-center py-20 bg-[#0A0A0A] rounded-2xl border border-white/5">
                <Calendar size={48} className="text-white/10 mx-auto mb-4" />
                <p className="text-white font-black uppercase italic text-lg text-content-muted">No Upcoming Matches</p>
                <p className="text-content-muted text-sm mt-1">All matches have been completed for this category.</p>
            </div>
        );
    }

    if (!hasGroups) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-[0.15em]">
                            <Calendar className="text-[#4D78FF]" size={24} /> Upcoming Match Schedule
                        </h3>
                        <p className="text-content-secondary text-sm">Follow the order of play and upcoming times.</p>
                    </div>
                </div>
                <div className="grid gap-3">
                    {sortedAll.map(m => renderCard(m))}
                </div>
            </div>
        );
    }

    const grouped = sortedAll.reduce((acc, m) => {
        let g = m.group;
        if (!g && m.roundName && m.roundName.startsWith('Group ')) {
            g = m.roundName.replace('Group ', '');
            g = g.replace(' (Reverse)', '');
        }
        g = g || 'Knockouts';
        if (!acc[g]) acc[g] = [];
        acc[g].push(m);
        return acc;
    }, {} as Record<string, Match[]>);

    const groupKeys = Object.keys(grouped).sort((a,b) => {
        if (a === 'Knockouts') return 1;
        if (b === 'Knockouts') return -1;
        return a.localeCompare(b);
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-[0.15em]">
                        <Calendar className="text-[#4D78FF]" size={24} /> Upcoming Match Schedule
                    </h3>
                    <p className="text-content-secondary text-sm">Follow the order of play and upcoming times.</p>
                </div>
            </div>

            {groupKeys.map(k => (
                <div key={k} className="mb-6">
                    <h4 className="text-xs font-black text-[#4D78FF] uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">
                        {k === 'Knockouts' ? 'Knockout Phase' : `Group ${k}`}
                    </h4>
                    <div className="grid gap-3">
                        {grouped[k].map(m => renderCard(m))}
                    </div>
                </div>
            ))}
        </div>
    );
};
