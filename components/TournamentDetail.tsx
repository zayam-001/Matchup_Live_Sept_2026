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
  Timer
} from 'lucide-react';
import gsap from 'gsap';
import { Tournament, Match, Team, MatchStatus, SponsorTier } from '../types';
import { isMatchInCategory, isTeamInCategory } from '../services/storage';
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
}

export const TournamentDetail: React.FC<TournamentDetailProps> = ({
  tournament,
  matches,
  onBack,
  onEnterBroadcastMode,
  initialTab = 'live'
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

  // Filters matches & teams based on category selection
  const matchesToDisplay = (tournament.categories && tournament.categories.length > 0) && selectedCategoryId
    ? matches.filter((m: any) => isMatchInCategory(m, selectedCategoryId, tournament))
    : matches;

  const teamsToDisplay = (tournament.categories && tournament.categories.length > 0) && selectedCategoryId
    ? (tournament.teams || []).filter((t: any) => isTeamInCategory(t, selectedCategoryId, tournament))
    : (tournament.teams || []);

  const liveMatches = matchesToDisplay.filter((m: any) => 
    (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE' || String(m.status).toUpperCase() === 'IN_PROGRESS') && 
    !m.winnerTeamId
  );

  const tabs = [
    { id: 'live', label: 'Live', icon: Activity },
    { id: 'schedule', label: 'Sched', icon: Calendar },
    { id: 'results', label: 'Scores', icon: Award },
    { id: 'standings', label: 'Rank', icon: Trophy },
    { id: 'timeline', label: 'Feed', icon: History }
  ];

  return (
    <div className="pb-32 pt-28 max-w-[1400px] mx-auto w-full animate-in fade-in duration-500 px-4 md:px-8 relative">
      
      {/* Top Controls Row */}
      <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-6 pb-4 flex justify-between items-center relative z-10">
        <button 
          onClick={onBack} 
          className="text-white hover:text-[#4D78FF] flex items-center gap-2 transition-all cursor-pointer border-none bg-transparent whitespace-nowrap text-xs font-black uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:bg-white/10"
        >
          &larr; Back to Lobby
        </button>
        {onEnterBroadcastMode && (
          <button 
            onClick={onEnterBroadcastMode} 
            className="bg-[#E65C31] text-white px-4 py-2 rounded-full font-black flex items-center gap-2 hover:bg-[#ff6d3f] transition-colors cursor-pointer border-none text-xs uppercase tracking-widest shadow-lg shadow-[#E65C31]/20 animate-pulse-subtle"
          >
            <Tv size={14} />
            <span>Broadcast Mode</span>
          </button>
        )}
      </div>

      {/* Hero Header */}
      <div className="max-w-7xl mx-auto mb-10 px-4 md:px-0">
        <div className="relative w-full rounded-3xl overflow-hidden border border-white/5 bg-[#111111] shadow-2xl">
          
          {/* Banner Image / Gradient */}
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            {tournament.bannerUrl ? (
              <>
                <img 
                  src={tournament.bannerUrl} 
                  alt="" 
                  className="w-full h-full object-cover opacity-25 scale-105 filter blur-[2px]" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/85 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-transparent to-[#0A0A0A]" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#4D78FF]/10 via-[#0A0A0A] to-[#E65C31]/10 opacity-60">
                <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,#fff_12.5%,transparent_12.5%,transparent_50%,#fff_50%,#fff_62.5%,transparent_62.5%,transparent_100%)] bg-[length:30px_30px]" />
              </div>
            )}
          </div>

          {/* Header Content Grid */}
          <div className="relative z-10 px-6 py-10 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex flex-col md:flex-row items-start gap-6 max-w-4xl">
              
              {/* Organizer Logo */}
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-[#1A1A1A] border-2 border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-xl relative">
                {tournament.organizerLogo ? (
                  <img 
                    src={tournament.organizerLogo} 
                    alt="" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="font-black text-2xl text-white/50">{tournament.organizer?.substring(0, 2).toUpperCase() || 'MA'}</span>
                )}
              </div>

              {/* Title & Stats */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="brand" className="bg-[#4D78FF]/15 text-[#4D78FF] border-[#4D78FF]/30">
                    {tournament.sport || 'Padel'}
                  </Badge>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Organised by <span className="text-white font-black">{tournament.organizer || 'Matchup Admin'}</span>
                  </span>
                </div>

                <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight leading-none">
                  {tournament.name}
                </h1>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-1 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-300">
                    <MapPin size={13} className="text-[#4D78FF]" />
                    <span className="uppercase tracking-wider text-[10px]">{tournament.venue || 'Global Arena'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-gray-300">
                    <Calendar size={13} />
                    <span className="uppercase tracking-wider text-[10px]">
                      {formatFullTime(tournament.startDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-gray-300">
                    <Users size={13} />
                    <span className="uppercase tracking-wider text-[10px]">{(tournament.teams || []).length} Teams Joined</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Formats & Prize Box */}
            <div className="flex flex-row md:flex-col items-center md:items-end gap-3 w-full md:w-auto border-t border-white/5 md:border-none pt-4 md:pt-0">
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-right shrink-0">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Tournament Format</div>
                <div className="text-xs font-black text-white uppercase tracking-wider mt-0.5">
                  {tournament.format?.replace(/_/g, ' ') || 'STANDARD'}
                </div>
              </div>

              <div className="bg-[#4D78FF]/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-right shrink-0">
                <div className="text-[9px] text-[#4D78FF] uppercase tracking-widest font-black">
                  {selectedCategoryId ? 'Category Prize' : 'Grand Prize Pool'}
                </div>
                <div className="text-sm font-black text-[#4D78FF] uppercase tracking-wider mt-0.5">
                  {tournament.currency === 'USD' ? '$' : 'Rs'} {((selectedCategoryId ? (tournament.categories?.find(c => c.id === selectedCategoryId)?.prizeMoney || tournament.prizeMoney) : tournament.prizeMoney) || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
      <div className="max-w-7xl mx-auto px-1 sm:px-4 mb-16">
        <div className="bg-[#111111]/50 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
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
          className="pointer-events-auto w-full max-w-[500px] shadow-2xl mx-auto"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 0px)'
          }}
        >
          <div 
            ref={tabsContainerRef} 
            className="relative flex items-center justify-between bg-[#111111]/90 backdrop-blur-md rounded-full border border-white/10 p-1 md:p-1.5 shadow-2xl"
          >
            {/* Sliding GSAP indicator pill */}
            <div 
              ref={indicatorRef} 
              className="absolute top-1 bottom-1 md:top-1.5 md:bottom-1.5 rounded-full bg-gradient-to-r from-[#4D78FF] to-[#E65C31] shadow-lg shadow-[#4D78FF]/20"
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
