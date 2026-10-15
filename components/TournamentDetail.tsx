import { CategorySelector } from "./ui/CategorySelector";
import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Calendar, 
  Award, 
  Trophy, 
  History, 
  MapPin, 
  Users, 
  Tv,
  Timer,
  Share2,
  Play,
  Layers
} from 'lucide-react';
import './spectator.css';
import gsap from 'gsap';
import { Tournament, Match, Team, MatchStatus, SponsorTier } from '../types';
import { isMatchInCategory, isTeamInCategory } from '../services/storage';
import { formatLabel } from '../lib/teamAmericano';
import { Badge } from './ui/Badge';
import { 
  LiveMatchesTable, 
  SpectatorSchedule, 
  SpectatorResults, 
  StandingsTable, 
  MatchTimeline 
} from './LiveScoreboard';
import { TeamDetailsOverlay } from './TeamDetailsOverlay';

// Helper functions copied from LiveScoreboard to ensure absolute format parity
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

interface TournamentDetailProps {
  tournament: Tournament;
  matches: Match[];
  onBack: () => void;
  onEnterBroadcastMode?: () => void;
  initialTab?: 'live' | 'schedule' | 'results' | 'standings' | 'timeline';
  searchQuery?: string;
}

export const TournamentDetail: React.FC<TournamentDetailProps> = ({
  tournament,
  matches,
  onBack,
  onEnterBroadcastMode,
  initialTab = 'live',
  searchQuery
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'schedule' | 'results' | 'standings' | 'timeline'>(initialTab);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Set initial category if available
  useEffect(() => {
    if (tournament.categories && tournament.categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(tournament.categories[0].id);
    }
  }, [tournament, selectedCategoryId]);

  // GSAP animation for the active-tab sliding indicator
  useEffect(() => {
    if (!indicatorRef.current || !tabsContainerRef.current) return;
    const activeBtn = tabsContainerRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (!activeBtn) return;

    gsap.to(indicatorRef.current, {
      x: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
      duration: 0.35,
      ease: 'power3.out',
      overwrite: 'auto'
    });
  }, [activeTab]);

  // Filters matches & teams based on category selection AND optional search query
  const matchesToDisplay = React.useMemo(() => {
    let list = (tournament.categories && tournament.categories.length > 0) && selectedCategoryId
      ? matches.filter((m: any) => isMatchInCategory(m, selectedCategoryId, tournament))
      : matches;

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const teamMap = new Map((tournament.teams || []).map((t: Team) => [t.id, t]));
      list = list.filter((m: any) => {
        const t1 = teamMap.get(m.team1Id);
        const t2 = teamMap.get(m.team2Id);
        const t1Name = (t1?.name || '').toLowerCase();
        const t2Name = (t2?.name || '').toLowerCase();
        const court = (m.court || '').toLowerCase();
        const round = (m.roundName || '').toLowerCase();
        const pNames = [
          t1?.player1?.name,
          t1?.player2?.name,
          t2?.player1?.name,
          t2?.player2?.name,
          ...(((t1 as any)?.players || []).map((p: any) => p?.name || p?.fullName || '')),
          ...(((t2 as any)?.players || []).map((p: any) => p?.name || p?.fullName || ''))
        ].filter(Boolean).map((s: string) => s.toLowerCase());

        return t1Name.includes(q) || t2Name.includes(q) || court.includes(q) || round.includes(q) || pNames.some(p => p.includes(q));
      });
    }

    return list;
  }, [tournament, selectedCategoryId, matches, searchQuery]);

  const teamsToDisplay = React.useMemo(() => {
    let list = (tournament.categories && tournament.categories.length > 0) && selectedCategoryId
      ? (tournament.teams || []).filter((t: any) => isTeamInCategory(t, selectedCategoryId, tournament))
      : (tournament.teams || []);

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t: any) => {
        const nameMatch = (t.name || '').toLowerCase().includes(q);
        const pMatch = [
          t.player1?.name,
          t.player2?.name,
          ...((t.players || []).map((p: any) => p?.name || p?.fullName || ''))
        ].filter(Boolean).some((s: string) => s.toLowerCase().includes(q));
        return nameMatch || pMatch;
      });
    }

    return list;
  }, [tournament, selectedCategoryId, searchQuery]);

  const liveMatches = matchesToDisplay.filter((m: any) => 
    (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE' || String(m.status).toUpperCase() === 'IN_PROGRESS') && 
    !m.winnerTeamId
  );

  const tabs = [
    { id: 'live', label: 'Live', icon: Activity },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'results', label: 'Results', icon: Award },
    { id: 'standings', label: 'Standings', icon: Trophy },
    { id: 'timeline', label: 'Feed', icon: History }
  ];

  // Hero facts.
  const finishedCount = matchesToDisplay.filter((m: any) => m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED').length;
  const now = Date.now();
  const startTs = tournament.startDate ? new Date(tournament.startDate).getTime() : 0;
  const endTs = tournament.endDate ? new Date(tournament.endDate).getTime() : 0;
  const heroStatus = liveMatches.length > 0 ? 'live' : (tournament.status === 'COMPLETED' || (endTs && endTs < now)) ? 'done' : (startTs && startTs > now) ? 'soon' : 'on';
  const prize = (selectedCategoryId ? (tournament.categories?.find(c => c.id === selectedCategoryId)?.prizeMoney || tournament.prizeMoney) : tournament.prizeMoney) || 0;
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: tournament.name, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled */ }
  };
  const watchLive = () => {
    setActiveTab('live');
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // Slow parallax on the hero artwork.
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--spx-par', `${Math.max(-60, Math.min(60, -r.top * 0.18))}px`);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="spx pb-32 pt-24 max-w-[1400px] mx-auto w-full animate-in fade-in duration-500 px-4 md:px-8 relative">
      
      {/* ── Cinematic hero: the event's own artwork leads ── */}
      <section ref={heroRef} className="spx-hero">
        <div className="spx-hero__media" aria-hidden="true">
          {tournament.bannerUrl
            ? <img src={tournament.bannerUrl} alt="" referrerPolicy="no-referrer" />
            : <div className="spx-hero__art"><span className="spx-hero__art-court" /></div>}
        </div>
        <div className="spx-hero__shade" aria-hidden="true" />
        <div className="spx-hero__inner">
          <div className="spx-hero__chips">
            <span className={`spx-status spx-status--${heroStatus}`}>
              {heroStatus === 'live' && <span className="spx-dot" />}
              {heroStatus === 'live' ? `Live now · ${liveMatches.length} ${liveMatches.length === 1 ? 'match' : 'matches'}` : heroStatus === 'done' ? 'Tournament finished' : heroStatus === 'soon' ? `Starts ${formatFullTime(tournament.startDate)}` : 'Underway'}
            </span>
          </div>
          <h1 className="spx-hero__title">{tournament.name}</h1>
          <div className="spx-hero__meta">
            <span><MapPin size={14} /> {tournament.venue || 'Global Arena'}</span>
            <span><Calendar size={14} /> {formatFullTime(tournament.startDate)}</span>
            <span><Users size={14} /> {(tournament.teams || []).length} teams</span>
            <span><Layers size={14} /> {tournament.format ? formatLabel(tournament.format) : 'Standard'}</span>
          </div>
          <div className="spx-hero__actions">
            {onEnterBroadcastMode && <button type="button" className="spx-btn spx-btn--primary" onClick={onEnterBroadcastMode}><Tv size={16} /> Broadcast mode</button>}
            <button type="button" className={`spx-btn ${onEnterBroadcastMode ? 'spx-btn--ghost' : 'spx-btn--primary'}`} onClick={watchLive}><Play size={16} /> {liveMatches.length ? 'Watch live' : 'View matches'}</button>
            <button type="button" className="spx-btn spx-btn--icon" onClick={share} aria-label="Share tournament"><Share2 size={16} />{copied && <span className="spx-copied">Link copied</span>}</button>
          </div>
        </div>
        <div className="spx-stats">
          <div className="spx-stat"><span className="spx-stat__icon"><Activity size={16} /></span><strong>{liveMatches.length}</strong><small>Live now</small></div>
          <div className="spx-stat"><span className="spx-stat__icon"><Users size={16} /></span><strong>{(teamsToDisplay || []).length}</strong><small>Teams</small></div>
          <div className="spx-stat"><span className="spx-stat__icon"><Layers size={16} /></span><strong>{finishedCount}<em>/{matchesToDisplay.length}</em></strong><small>Matches played</small></div>
          <div className="spx-stat spx-stat--prize"><span className="spx-stat__icon"><Trophy size={16} /></span><strong>{tournament.currency === 'USD' ? '$' : 'Rs'} {prize.toLocaleString()}</strong><small>{selectedCategoryId ? 'Category prize' : 'Prize pool'}</small></div>
        </div>
      </section>

      {/* Innovative 3D Animated Category Selector */}
      {tournament.categories && tournament.categories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mb-10 mt-6 z-20 relative">
          <CategorySelector 
            categories={tournament.categories} 
            selectedCategoryId={selectedCategoryId} 
            onSelectCategory={setSelectedCategoryId} 
            matches={matches} 
          />
        </div>
      )}

      {/* Main Tab Content Display Panel */}
      <div ref={contentRef} className="max-w-7xl mx-auto px-1 sm:px-4 mb-16 spx-content-wrap">
        <div className="spx-panel" key={activeTab}>
          <div className="p-1.5 sm:p-6 md:p-8 min-h-[500px]">
            {activeTab === 'live' && (
              <div className="animate-in fade-in duration-500">
                {liveMatches.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <Timer size={48} className="text-[#9CA3AF] mb-4" />
                    <p className="text-white text-xl font-black italic tracking-[0.15em] uppercase">No active matches</p>
                    <p className="text-[#9CA3AF] text-sm uppercase tracking-widest font-bold mt-2">Waiting for the next serve...</p>
                  </div>
                ) : (
                  <LiveMatchesTable matches={liveMatches} teams={tournament.teams || []} tournament={tournament} />
                )}
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="animate-in fade-in duration-500">
                <SpectatorSchedule 
                  matches={matchesToDisplay} 
                  teams={tournament.teams || []} 
                  onSelectTab={(tab) => {
                    const mappedTab = tab === 'timelines' ? 'timeline' : tab;
                    setActiveTab(mappedTab as any);
                  }} 
                />
              </div>
            )}

            {activeTab === 'results' && (
              <div className="animate-in fade-in duration-500">
                <SpectatorResults matches={matchesToDisplay} teams={tournament.teams || []} tournament={tournament} />
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="animate-in fade-in duration-500">
                {(() => {
                  const timelineMatches = matchesToDisplay.filter((m: any) => m.score?.history && m.score.history.length > 0);
                  if (timelineMatches.length === 0) {
                    return (
                      <div className="py-20 flex flex-col items-center justify-center text-center">
                        <History size={48} className="text-[#9CA3AF] mb-4" />
                        <p className="text-white text-xl font-black italic tracking-[0.15em] uppercase">No Action Log</p>
                      </div>
                    );
                  }
                  return <MatchTimeline matches={timelineMatches} teams={tournament.teams || []} />;
                })()}
              </div>
            )}

            {activeTab === 'standings' && (
              <div className="animate-in fade-in duration-500">
                <StandingsTable 
                  tournament={tournament} 
                  tournamentId={tournament.id} 
                  categoryId={selectedCategoryId} 
                  initialTeams={teamsToDisplay} 
                  onTeamSelect={setSelectedTeam} 
                  matches={matchesToDisplay}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team details overlays */}
      {selectedTeam && (
        <TeamDetailsOverlay 
          team={selectedTeam} 
          tournament={tournament} 
          matches={matchesToDisplay} 
          teams={tournament.teams || []}
          onClose={() => setSelectedTeam(null)} 
        />
      )}

      {/* Floating Bottom Navigation Bar with Safe Area Inset Padding */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 flex justify-center z-50 pointer-events-none">
        <div 
          className="pointer-events-auto w-full max-w-[600px] mx-auto"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 0px)'
          }}
        >
          <div 
            ref={tabsContainerRef} 
            className="spx-dock relative flex items-center justify-between rounded-full p-1 md:p-1.5"
          >
            {/* Sliding GSAP indicator pill */}
            <div 
              ref={indicatorRef} 
              className="spx-dock__pill absolute top-1 bottom-1 md:top-1.5 md:bottom-1.5 rounded-full"
              style={{ left: 0, width: 0 }}
            />
            
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative z-10 flex flex-col md:flex-row items-center justify-center py-2 px-3 md:py-3 md:px-4 rounded-full text-center transition-all duration-300 cursor-pointer border-none bg-transparent whitespace-nowrap overflow-visible gap-1 md:gap-2 flex-1 ${
                    isActive ? 'text-white font-black' : 'text-gray-400 hover:text-white font-bold'
                  }`}
                >
                  <TabIcon size={16} className={`shrink-0 md:w-[18px] md:h-[18px] transition-colors ${isActive ? 'text-white animate-pulse' : 'text-gray-400'}`} />
                  <div className="flex items-center justify-center">
                    <span className={`text-[9px] md:text-xs uppercase tracking-wider md:tracking-widest font-display whitespace-nowrap ${isActive ? 'font-black' : 'font-bold'}`}>
                      {tab.label}
                    </span>
                    {tab.id === 'live' && liveMatches.length > 0 && <span className="spx-dock__badge">{liveMatches.length}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
