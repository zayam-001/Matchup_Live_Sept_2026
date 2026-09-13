import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getFirestore, collectionGroup, query, onSnapshot } from 'firebase/firestore';
import { db, subscribeToTournaments, subscribeToStandings, isTeamInCategory, isMatchInCategory, calculateStats, checkAndHealTournamentStats } from '../services/storage';
import { useMatchResult } from '../hooks/useMatchResult';
import { useTournamentDoc } from '../hooks/useTournamentDoc';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import { MatchStatus, Tournament, TournamentFormat, RoundRobinType, Team, Match, SponsorTier, MatchEvent } from '../types';
import { ChevronRight, Play, Info, Trophy, History, Timer, MapPin, Award, X, Activity, ChevronDown, Users, Mic, DollarSign, Tv, Calendar, Check, LayoutGrid, List } from 'lucide-react';
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

  if (!selectedTournamentId) return <TournamentList tournaments={tournaments} onSelect={handleSelectTournament} />;
  if (loadingTournament) return <div className="text-center p-10 text-gray-500">Loading...</div>;
  if (!activeTournament) return <div className="text-center p-10 text-gray-400">Tournament not found</div>;

  const matchesToDisplay = (activeTournament.categories && activeTournament.categories.length > 0) && selectedCategoryId
        ? tournamentMatches.filter((m: any) => isMatchInCategory(m, selectedCategoryId, activeTournament))
        : tournamentMatches;

  const teamsToDisplay = (activeTournament.categories && activeTournament.categories.length > 0) && selectedCategoryId
        ? (activeTournament.teams || []).filter((t: any) => isTeamInCategory(t, selectedCategoryId, activeTournament))
        : (activeTournament.teams || []);

  const liveMatches = matchesToDisplay.filter((m: any) => 
    (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE' || String(m.status).toUpperCase() === 'IN_PROGRESS') && 
    !m.winnerTeamId
  );
  const completedMatches = matchesToDisplay
    .filter((m: any) => (m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED' || String(m.status).toUpperCase() === 'COMPLETED') || !!m.winnerTeamId)
    .sort((a: any, b: any) => getMatchTimestamp(b) - getMatchTimestamp(a));
  
  const upcomingMatches = matchesToDisplay
    .filter((m: any) => m.status === MatchStatus.SCHEDULED || !m.status || String(m.status).toUpperCase() === 'SCHEDULED')
    .sort((a: any, b: any) => getMatchTimestamp(a) - getMatchTimestamp(b));

  const latestFinished = completedMatches.length > 0 ? completedMatches[0] : null;

  // Process Sponsors
  const sponsors = activeTournament.sponsors || [];
  const titleSponsor = sponsors.find((s: any) => typeof s !== 'string' && s.tier === SponsorTier.TITLE);
  // Gold and Platinum get Live Match placement
  const premiumSponsors = sponsors.filter((s: any) => typeof s !== 'string' && (s.tier === SponsorTier.GOLD || s.tier === SponsorTier.PLATINUM || s.tier === SponsorTier.TITLE));
  // All non-title sponsors go to marquee (including legacy strings)
  const marqueeSponsors = sponsors.filter((s: any) => typeof s === 'string' || s.tier !== SponsorTier.TITLE);

  if (isBroadcastMode && activeTournament) {
      return <BroadcastMode tournament={activeTournament} onClose={() => setIsBroadcastMode(false)} />;
  }

  return (
    <TournamentDetail
      tournament={activeTournament}
      matches={tournamentMatches}
      onBack={() => handleSelectTournament(null)}
      onEnterBroadcastMode={() => setIsBroadcastMode(true)}
    />
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

const TournamentList = ({ tournaments, onSelect }: any) => {
    const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
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
        if (t.status === 'ACTIVE' && (hasLiveMatch || (t.startDate && new Date(t.startDate) <= now))) {
            return 'live';
        }
        return 'upcoming';
    };

    const categorized = React.useMemo(() => {
        const live: Tournament[] = [];
        const upcoming: Tournament[] = [];
        const completed: Tournament[] = [];

        tournaments.forEach((t: Tournament) => {
            const cat = categorizeTournament(t);
            if (cat === 'live') live.push(t);
            else if (cat === 'upcoming') upcoming.push(t);
            else completed.push(t);
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

        return { live, upcoming, completed };
    }, [tournaments, liveMatchTournamentIds]);

    const featuredTournament = React.useMemo(() => {
        return categorized.live[0] || categorized.upcoming[0] || categorized.completed[0] || null;
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
        { id: 'upcoming', label: 'Upcoming', count: categorized.upcoming.length },
        { id: 'completed', label: 'Completed', count: categorized.completed.length }
    ];

    return (
        <div className="min-h-screen pt-20 md:pt-28 pb-24 px-4 md:px-8 max-w-7xl mx-auto w-full">
            {/* Cinematic Billboard (Hero Section) */}
            {activeCategoryTab === 'all' && featuredTournament && (
                <div 
                    className="relative w-full h-[60vh] md:h-[75vh] flex items-end justify-start overflow-hidden rounded-3xl mb-16 border border-white/5 shadow-2xl bg-[#1B1B1E]"
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
                            <div className="w-full h-full bg-gradient-to-br from-[#4D78FF]/20 via-[#111113] to-[#1B1B1E] flex items-center justify-center">
                                <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,#fff_12.5%,transparent_12.5%,transparent_50%,#fff_50%,#fff_62.5%,transparent_62.5%,transparent_100%)] bg-[length:30px_30px]" />
                            </div>
                        )}
                        {/* Perfect cinematic dark overlays */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-black/40 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/20 to-transparent" />
                        <div className="absolute inset-0 bg-black/25" />
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
                                className="bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-8 py-3.5 rounded-xl hover:bg-[#4D78FF] hover:text-white transition-all shadow-xl hover:shadow-[#4D78FF]/20 cursor-pointer flex items-center gap-2 border-none"
                            >
                                <Play size={14} fill="currentColor" />
                                <span>Watch Live Arena</span>
                            </button>
                            <a 
                                href={`#register/${featuredTournament.slug || featuredTournament.id}`}
                                className="bg-white/10 hover:bg-white/15 text-white border border-white/10 font-black uppercase tracking-widest text-[10px] md:text-xs px-8 py-3.5 rounded-xl transition-all shadow-lg flex items-center gap-2"
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

                {activeCategoryTab !== 'all' && categorized[activeCategoryTab].length === 0 && (
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

    const t1DisplayName = formatCleanName([ t1P1Name, t1P2Name ].filter(n => n && n.trim()).join(' & ') || t1?.name || match.team1Name || 'TBA') || 'TBA';
    const t2DisplayName = formatCleanName([ t2P1Name, t2P2Name ].filter(n => n && n.trim()).join(' & ') || t2?.name || match.team2Name || 'TBA') || 'TBA';

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
    const t1DisplayName = formatCleanName([ getFirstName(t1?.player1?.name), getFirstName(t1?.player2?.name) ].filter(n => n && n.trim()).join(' & ') || t1?.name || match.team1Name || 'TBA') || 'TBA';
    const t2DisplayName = formatCleanName([ getFirstName(t2?.player1?.name), getFirstName(t2?.player2?.name) ].filter(n => n && n.trim()).join(' & ') || t2?.name || match.team2Name || 'TBA') || 'TBA';

    const isAmericanoMatch = match.roundName?.toLowerCase().includes("americano") || (match.score && (match.score.americanoTargetPoints !== undefined || match.score.americanoMode !== undefined));

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
        const unsub = subscribeToStandings(tournamentId, categoryId, (data) => {
            const source = (data && data.length > 0) ? data : (tournament?.teams || initialTeams || []);
            const filtered = source.filter((t: any) => isTeamInCategory(t, categoryId, tournament));
            
            // Check if filtered has meaningful stats or if we should fallback to dynamic calculation
            const allZeroes = filtered.length > 0 && filtered.every((t: any) => (t.matchesPlayed || 0) === 0 && (t.wins || 0) === 0 && (t.points || 0) === 0);
            
            if ((filtered.length === 0 || allZeroes) && matches && matches.length > 0 && tournament) {
                const categoryTeams = (tournament.teams || source).filter((t: any) => isTeamInCategory(t, categoryId, tournament));
                if (categoryTeams.length > 0) {
                    const computed = calculateStats(categoryTeams, matches, tournament.format, tournament.categories);
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
            checkAndHealTournamentStats(tournament, matches, categoryId);
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
    const t1DisplayName = formatCleanName([ getFirstName(t1Obj?.player1?.name), getFirstName(t1Obj?.player2?.name) ].filter(n => n && n.trim()).join(' & ') || t1Obj?.name || match.team1Name || 'TBD') || 'TBD';
    const t2DisplayName = formatCleanName([ getFirstName(t2Obj?.player1?.name), getFirstName(t2Obj?.player2?.name) ].filter(n => n && n.trim()).join(' & ') || t2Obj?.name || match.team2Name || 'TBD') || 'TBD';

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

const BroadcastMode = ({ tournament, onClose }: { tournament: Tournament, onClose: () => void }) => {
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    const [selectedMatchId, setSelectedMatchId] = useState<string | 'ALL'>('ALL');
    const liveMatches = globalMatches.filter(m => 
        (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE' || String(m.status).toUpperCase() === 'IN_PROGRESS') && 
        !m.winnerTeamId
    );
    
    const baseWatchers = Math.max(800, (liveMatches.length * 400) + Math.floor(Math.random() * 500));
    const [watchers, setWatchers] = useState(baseWatchers);

    useEffect(() => {
        const interval = setInterval(() => {
            setWatchers(prev => {
                const shift = Math.floor(Math.random() * 7) - 3;
                return Math.max(10, prev + shift);
            });
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!selectedMatchId && liveMatches.length > 0) {
            setSelectedMatchId('ALL');
        }
    }, [liveMatches, selectedMatchId]);

    const activeMatch = selectedMatchId !== 'ALL' ? liveMatches.find(m => m.id === selectedMatchId) : null;
    
    const globalRecentEvents = [];
    liveMatches.forEach(m => {
        const hist = m.score?.history || [];
        hist.slice(-2).forEach((ev) => {
            if(ev.startsWith('T1') || ev.startsWith('T2')) {
                const parts = ev.split('|');
                const type = parts[0];
                const pIdx = parseInt(parts[2] || "1");
                const tag = parts[3];
                const finisher = parts[4];
                const t1 = tournament.teams.find((t) => t.id === m.team1Id);
                const t2 = tournament.teams.find((t) => t.id === m.team2Id);
                const team = type === 'T1' ? t1 : t2;
                const player = pIdx === 1 ? team?.player1?.name : team?.player2?.name;
                const teamName = team?.name || type;
                let actionStr = "Point Won";
                if (finisher === 'smash') actionStr = "SMASH WINNER";
                else if (finisher === 'vibora') actionStr = "VIBORA WINNER";
                else if (finisher === 'drop' || finisher === 'drop shot') actionStr = "DROP SHOT WINNER";
                else if (finisher === 'bandeja') actionStr = "BANDEJA WINNER";
                else if (finisher === 'volley') actionStr = "VOLLEY WINNER";
                else if (tag === 'winner') actionStr = "WINNER";
                else if (tag === 'error') actionStr = "UNFORCED ERROR";
                else if (finisher === 'net') actionStr = "NET ERROR";
                else if (finisher === 'glass') actionStr = "GLASS ERROR";
                
                globalRecentEvents.push(`${m.court || 'Court'} - ${player || teamName}: ${actionStr}`);
            }
        });
    });

    return createPortal(
        // SAFE-ZONE FIX (found live testing this real app): this rendered
        // content flush to the true edges of the viewport, but many
        // TVs/LCD panels driven over HDMI apply their own overscan crop
        // (commonly 3-5% per edge) that this page has no way to detect —
        // so names, the close button, and score boxes got cut off on a
        // real court-side display even though the page looked fine in a
        // browser tab. Percentage-based padding on the outer frame keeps
        // everything inside a safe area that scales with the actual
        // screen size, instead of the old fixed pixel padding (p-6/p-12)
        // which was a negligible fraction of a large TV's resolution.
        <div className="fixed inset-0 z-[11000] bg-[#0d0d0f] text-white flex flex-col font-sans selection:bg-[#4D78FF]/30 overflow-hidden p-[3%] sm:p-[4%] gap-4">
            {/* Minimal floating exit button */}
            <button
                onClick={onClose}
                className="fixed top-[3%] right-[3%] sm:top-[4%] sm:right-[4%] z-[12000] p-3 hover:bg-white/20 bg-black/60 rounded-full transition-colors border border-white/10 shrink-0 cursor-pointer shadow-xl backdrop-blur-md opacity-40 hover:opacity-100"
                title="Close Broadcast Mode"
            >
                <X size={20} className="text-white" />
            </button>

            {/* Main Stage */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
                {selectedMatchId === 'ALL' && liveMatches.length > 0 ? (
                    // UI FIX (found live testing this real app): with only
                    // 1-2 live matches, this forced lg:grid-cols-3 and always
                    // compact=true, leaving matches small and top-left with
                    // most of the screen empty black space - exactly the
                    // "tiny card on a real TV" complaint reported earlier for
                    // the sibling Vercel build, ported here since the
                    // single-match "activeMatch" branch below is never
                    // actually reachable (nothing ever sets selectedMatchId
                    // to a specific match). Column count now tracks the
                    // actual number of live matches, and h-full +
                    // auto-rows-fr makes the grid (and every card in it,
                    // since BroadcastMatchCard is already h-full) stretch to
                    // fill the whole stage instead of sitting at its own
                    // content height; compact mode only kicks in once there
                    // are enough matches that full-size cards wouldn't fit.
                    <div className={`grid h-full auto-rows-fr gap-4 md:gap-8 ${
                        liveMatches.length === 1 ? 'grid-cols-1' :
                        liveMatches.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                        liveMatches.length === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
                    }`}>
                        {liveMatches.map(m => (
                            <BroadcastMatchCard key={m.id} match={m} teams={tournament.teams} categories={tournament.categories} tournament={tournament} compact={liveMatches.length > 2} />
                        ))}
                    </div>
                ) : activeMatch ? (
                    <div className="h-full flex flex-col xl:flex-row items-center xl:items-stretch justify-center gap-8 max-w-7xl mx-auto w-full min-h-0">
                        <div className="flex-1 w-full flex flex-col justify-center min-h-0 shrink-0 xl:shrink">
                            <BroadcastMatchCard match={activeMatch} teams={tournament.teams} categories={tournament.categories} tournament={tournament} />
                        </div>
                        <div className="w-full xl:w-[420px] min-h-[400px] xl:min-h-0 flex flex-col shrink-0">
                            <MatchTimeline matches={[activeMatch]} teams={tournament.teams || []} />
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-white/50 font-black uppercase tracking-widest text-sm md:text-base text-center">
                        No live matches currently broadcasting
                    </div>
                )}
            </main>

            {/* Global Animated Ticker Slider at Bottom */}
            {true && (() => {
                const tickerEvents: string[] = [];

                // 1. Add active live match alerts
                liveMatches.forEach(m => {
                    const t1 = tournament.teams?.find((t: any) => t.id === m.team1Id);
                    const t2 = tournament.teams?.find((t: any) => t.id === m.team2Id);
                    const t1Name = t1?.name || m.team1Name || 'Team 1';
                    const t2Name = t2?.name || m.team2Name || 'Team 2';
                    const score = m.score || { p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0, p1Sets: 0, p2Sets: 0 };
                    tickerEvents.push(`COURT: ${m.court || 'Main'} • LIVE SCORE: ${t1Name} ${score.p1Points === '0' ? '00' : score.p1Points} - ${score.p2Points === '0' ? '00' : score.p2Points} ${t2Name} (Sets: ${score.p1Sets}-${score.p2Sets})`);
                });

                // 2. Add completed match results
                const completedMatches = (globalMatches || []).filter(m => 
                    m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED' || !!m.winnerTeamId
                );
                completedMatches.slice(0, 5).forEach(m => {
                    const t1 = tournament.teams?.find((t: any) => t.id === m.team1Id);
                    const t2 = tournament.teams?.find((t: any) => t.id === m.team2Id);
                    const t1Name = t1?.name || m.team1Name || 'Team 1';
                    const t2Name = t2?.name || m.team2Name || 'Team 2';
                    const winnerId = m.winnerTeamId;
                    const winnerName = winnerId === m.team1Id ? t1Name : winnerId === m.team2Id ? t2Name : 'TBD';
                    const score = m.score || { p1Sets: 0, p2Sets: 0 };
                    tickerEvents.push(`RESULT: ${t1Name} VS ${t2Name} • WINNER: ${winnerName} (Sets: ${score.p1Sets}-${score.p2Sets})`);
                });

                // 3. Fallback standard ticker info if nothing is available
                if (tickerEvents.length === 0) {
                    tickerEvents.push(`${tournament.name} • LIVE FROM ${tournament?.venue || 'GLOBAL ARENA'} • EXQUISITE PADEL ACTION STREAMING LIVE ON MATCHUP`);
                }

                return (
                    <footer className="bg-[#4D78FF] text-white flex items-center gap-8 font-mono text-[0.75rem] uppercase font-bold shrink-0">
                        <div className="bg-black/20 px-6 py-3 shrink-0 uppercase tracking-widest font-black">
                            Live Updates
                        </div>
                        <div className="flex-1 overflow-hidden whitespace-nowrap fade-edges relative">
                            <div className="inline-block animate-marquee">
                                {tickerEvents.map((evt, j) => (
                                    <span key={j} className="mx-8 font-black">{evt}</span>
                                ))}
                                {tickerEvents.map((evt, j) => (
                                    <span key={`dup-${j}`} className="mx-8 font-black">{evt}</span>
                                ))}
                            </div>
                        </div>
                    </footer>
                );
            })()}
        </div>,
        document.body
    );
};
const BroadcastMatchCard = ({ match: initialMatch, teams, compact, categories, tournament }: any) => {
    const { matchData } = useMatchResult(initialMatch.id);
    const match = matchData || initialMatch;

    const t1 = teams.find((t: any) => t.id === match.team1Id);
    const t2 = teams.find((t: any) => t.id === match.team2Id);
    const category = categories?.find((c: any) => c.id === match.categoryId);
    const catName = category?.name || 'General';

    const t1P1Name = t1?.player1?.name;
    const t1P2Name = t1?.player2?.name;
    const t2P1Name = t2?.player1?.name;
    const t2P2Name = t2?.player2?.name;

    let t1FullName = formatCleanName([ t1P1Name, t1P2Name ].filter(n => n && n.trim()).join(' & ') || t1?.name || match.team1Name || 'TBA') || 'TBA';
    t1FullName = t1FullName.replace(/^&\s*/, '').replace(/\s*&$/, '').trim() || 'TBA';
    let t2FullName = formatCleanName([ t2P1Name, t2P2Name ].filter(n => n && n.trim()).join(' & ') || t2?.name || match.team2Name || 'TBA') || 'TBA';
    t2FullName = t2FullName.replace(/^&\s*/, '').replace(/\s*&$/, '').trim() || 'TBA';

    const [displayScore, setDisplayScore] = useState(match.score);
    const [flashOverlayTitle, setFlashOverlayTitle] = useState<string | null>(null);
    const [flashOverlaySubtitle, setFlashOverlaySubtitle] = useState<string | null>(null);
    const [lastHistoryLength, setLastHistoryLength] = useState(0);

    const effectiveHistory = getEffectiveEvents(match.score?.history || []);

    useEffect(() => {
        const isFinished = (match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') || String(match.status).toUpperCase() === 'COMPLETED';
        if (isFinished) {
            setDisplayScore(match.score);
            return;
        }
        
        if (effectiveHistory.length > lastHistoryLength && lastHistoryLength > 0) {
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
                else if (tag === 'winner') actionStr = "WINNER";
                else if (tag === 'error') actionStr = "UNFORCED ERROR";
                else if (finisher === 'net') actionStr = "NET ERROR";
                else if (finisher === 'glass') actionStr = "GLASS ERROR";
                else if (finisher === 'double fault') actionStr = "DOUBLE FAULT";
                else if (finisher === 'grill') actionStr = "GRILL ERROR";

                setFlashOverlayTitle(actionStr);
                setFlashOverlaySubtitle(player || teamName);
                
                setTimeout(() => {
                    setDisplayScore(match.score);
                }, 1000);

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

    const activeScore = displayScore || { p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0, p1Sets: 0, p2Sets: 0, currentSet: 1 };
    
    const isT1Serving = match.score?.server === 'p1' || match.score?.server === 'p2';
    const isT2Serving = match.score?.server === 'p3' || match.score?.server === 'p4';

    const scoreFlash = !!flashOverlayTitle;

    const formatNameHtml = (p1?: string, p2?: string, fallback?: string) => {
        const c1 = p1?.trim();
        const c2 = p2?.trim();
        if (c1 && c2) return <>{c1} &<br />{c2}</>;
        if (c1) return <>{c1}</>;
        if (c2) return <>{c2}</>;
        return <>{fallback}</>;
    };

    return (
        <div className={`bg-[#16161a] border-l-4 border-l-[#4D78FF] ${compact ? "p-3 pb-8 md:p-4 md:pb-12 gap-2 md:gap-3" : "p-6 pb-16 lg:p-8 lg:pb-18 gap-6 lg:gap-8"} flex flex-col relative overflow-hidden h-full shadow-2xl rounded-sm w-full`}>
            <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[radial-gradient(circle_at_top_right,rgba(77,120,255,0.15),transparent)] pointer-events-none" />
            
            <AnimatePresence>
                {scoreFlash && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="absolute inset-x-0 top-[40%] z-40 flex justify-center pointer-events-none"
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-[#4D78FF] px-5 py-1.5 rounded-full shadow-[0_0_15px_rgba(77,120,255,0.4)] border border-blue-300/50 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="text-white font-black uppercase tracking-widest text-xs drop-shadow-md">Point Won</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {flashOverlayTitle && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full px-4 py-6 bg-[#16161a] border-l-4 border-[#4D78FF] shadow-2xl flex flex-col items-center justify-center animate-in zoom-in-75 duration-300">
                        <span className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/50 mb-1 z-10 text-center">{flashOverlaySubtitle}</span>
                        <span className="font-black text-white text-2xl md:text-3xl uppercase z-10 text-center leading-tight">
                           {flashOverlayTitle}
                        </span>
                    </div>
                </div>
            )}
            
            <div className="flex flex-col gap-6 relative z-10 flex-1 justify-center min-h-0">
                <div className="flex justify-between items-center gap-4 group">
                    <div className={`font-black uppercase leading-[1.1] text-white break-words ${compact ? "text-base" : "text-2xl md:text-4xl lg:text-5xl xl:text-6xl"}`}>
                        {formatNameHtml(t1P1Name, t1P2Name, t1FullName)}
                        {isT1Serving && <span className="w-2 h-2 bg-[#E65C31] rounded-full inline-block ml-2 mb-1 shadow-[0_0_10px_#E65C31]" />}
                    </div>
                    <div className={`bg-white/5 rounded font-mono font-bold text-white shrink-0 ${compact ? "px-3 py-1.5 text-base" : "px-5 py-2 lg:px-8 lg:py-4 text-4xl lg:text-6xl"}`}>
                        {activeScore.p1Points === "0" ? "00" : activeScore.p1Points}
                    </div>
                </div>
                
                <div className="h-[1px] bg-white/10 w-full relative">
                    <div className="absolute left-0 -top-[10px] text-[0.6rem] font-black bg-[#16161a] pr-2.5 text-[#4D78FF] uppercase">VS</div>
                </div>
                
                <div className="flex justify-between items-center gap-4 group">
                    <div className={`font-black uppercase leading-[1.1] text-white break-words ${compact ? "text-base" : "text-2xl md:text-4xl lg:text-5xl xl:text-6xl"}`}>
                        {formatNameHtml(t2P1Name, t2P2Name, t2FullName)}
                        {isT2Serving && <span className="w-2 h-2 bg-[#E65C31] rounded-full inline-block ml-2 mb-1 shadow-[0_0_10px_#E65C31]" />}
                    </div>
                    <div className={`bg-white/5 rounded font-mono font-bold text-white shrink-0 ${compact ? "px-3 py-1.5 text-base" : "px-5 py-2 lg:px-8 lg:py-4 text-4xl lg:text-6xl"}`}>
                        {activeScore.p2Points === "0" ? "00" : activeScore.p2Points}
                    </div>
                </div>
            </div>

            <div className="relative z-10 mt-auto shrink-0">
                <div className="flex justify-between items-center mb-2">
                    <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-50 text-white flex items-center gap-2">
                        {catName}
                    </div>
                    {match.court && (
                        <div className="bg-[#4D78FF]/20 text-[#4D78FF] px-2 py-0.5 rounded text-[0.6rem] font-black uppercase tracking-widest border border-[#4D78FF]/30">
                            {match.court}
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-[1px] bg-white/10 mt-1">
                    <div className={`bg-[#16161a] text-center flex flex-col items-center ${compact ? "py-1.5" : "py-4 lg:py-6"}`}>
                        <div className="font-mono text-[0.6rem] lg:text-[0.65rem] uppercase tracking-[0.15em] opacity-50 text-white">Sets</div>
                        <div className={`font-black font-mono text-white mt-1 ${compact ? "text-lg" : "text-3xl lg:text-5xl"}`}>
                            {activeScore.p1Sets} - {activeScore.p2Sets}
                        </div>
                    </div>
                    <div className={`bg-[#16161a] text-center flex flex-col items-center ${compact ? "py-1.5" : "py-4 lg:py-6"}`}>
                        <div className="font-mono text-[0.6rem] lg:text-[0.65rem] uppercase tracking-[0.15em] opacity-50 text-white">Games</div>
                        <div className={`font-black font-mono text-white mt-1 ${compact ? "text-lg" : "text-3xl lg:text-5xl"}`}>
                            {activeScore.p1Games} - {activeScore.p2Games}
                        </div>
                    </div>
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

    return (
        <div className="w-full">
            <div className="flex flex-col gap-3">
                {matches.map(m => {
                    const { player1: t1p1, player2: t1p2 } = getTeamNamesAndPlayers(m.team1Id, m.team1Name, m.team1PlayerNames);
                    const { player1: t2p1, player2: t2p2 } = getTeamNamesAndPlayers(m.team2Id, m.team2Name, m.team2PlayerNames);
                    
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
                                                <span className="text-white font-black text-xs sm:text-sm uppercase tracking-wider truncate">{t1p1}</span>
                                                {(t1p2 && t1p2 !== 'Player 2' && t1p2 !== 'TBD') && <span className="text-gray-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider truncate">{t1p2}</span>}
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
                                                <span className="text-white font-black text-xs sm:text-sm uppercase tracking-wider truncate">{t2p1}</span>
                                                {(t2p2 && t2p2 !== 'Player 2' && t2p2 !== 'TBD') && <span className="text-gray-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider truncate">{t2p2}</span>}
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
                                                        {desc}
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
        let nm = [getFirstName(t?.player1?.name), getFirstName(t?.player2?.name)].filter(n => n && n.trim()).join(' & ') || t?.name || fallbackName || 'TBD';
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
