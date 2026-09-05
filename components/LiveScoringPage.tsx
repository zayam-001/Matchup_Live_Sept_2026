import React, { useState, useEffect } from 'react';
import { RotateCcw, ChevronLeft, Crown, AlertCircle, X, Plus, Target, Activity, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// import { NavigationMenu } from '../components/NavigationMenu'; // We might not have this, I will conditionally use it or comment out if not available
import { useLiveScoring, MatchData } from '../hooks/useLiveScoring';

type PlayerId = 'p1' | 'p2' | 'p3' | 'p4';
type TeamId = 'teamA' | 'teamB';
type FinisherType = 'Smash' | 'Bandeja' | 'Volea' | 'Net' | 'Wall' | 'Out' | 'Generic';

interface LocalPlayer {
  id: PlayerId;
  name: string;
  team: TeamId;
  dbId?: string;
}

interface MatchState {
  pointsA: number;
  pointsB: number;
  gamesA: number;
  gamesB: number;
  setsA: number;
  setsB: number;
  server: PlayerId | null;
  goldenPoint: boolean;
}

interface PointHistory {
  stateBefore: MatchState;
  action: {
    teamToAward?: TeamId;
    playerId?: PlayerId;
    type?: 'winner' | 'error' | 'point';
    finisher?: FinisherType;
    statOnly?: boolean;
  };
}

const INITIAL_STATE: MatchState = {
  pointsA: 0,
  pointsB: 0,
  gamesA: 0,
  gamesB: 0,
  setsA: 0,
  setsB: 0,
  server: null,
  goldenPoint: false,
};

export default function LiveScoringPage() {
  const { liveMatches, selectedMatch, teamA, teamB, loading, loadMatchDetails, syncMatchState, clearSelectedMatch } = useLiveScoring();

  const [matchState, setMatchState] = useState<MatchState>(INITIAL_STATE);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [activePlayerForTag, setActivePlayerForTag] = useState<PlayerId | null>(null);

  // Sync to Firebase whenever sets, games, points change
  useEffect(() => {
    if (selectedMatch) {
      syncMatchState(selectedMatch.id, matchState.setsA, matchState.setsB, {
        pointsA: matchState.pointsA,
        pointsB: matchState.pointsB,
        gamesA: matchState.gamesA,
        gamesB: matchState.gamesB,
        server: matchState.server,
        goldenPoint: matchState.goldenPoint
      });
    }
  }, [matchState, selectedMatch, syncMatchState]);

  // If no match selected, show directory selection UI
  if (!selectedMatch || !teamA || !teamB) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white p-4 md:p-8 flex flex-col">
        {/* <NavigationMenu /> */}
        <div className="max-w-4xl mx-auto w-full pt-16">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-2">
            <Activity className="w-6 h-6 text-[#E65C31]" />
            <span className="text-[#E65C31] text-sm font-black tracking-widest uppercase">Officiating</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-7xl font-black tracking-tighter mb-12">
            Live Matches
          </motion.h1>

          {loading ? (
            <div className="text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center p-20 animate-pulse">
              Loading Directory...
            </div>
          ) : liveMatches.length === 0 ? (
            <div className="bg-[#111] border-2 border-white/5 rounded-2xl p-12 text-center text-gray-500 font-medium tracking-wide">
              No live matches found right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {liveMatches.map((match, i) => (
                <motion.button 
                  key={match.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => loadMatchDetails(match.id)}
                  className="bg-[#111] hover:bg-[#151515] hover:border-[#4D78FF]/50 transition-all border border-white/10 p-6 rounded-2xl flex flex-col text-left group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#4D78FF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex justify-between items-center w-full mb-6 relative z-10">
                    <span className="bg-red-500/10 text-red-500 px-3 py-1 text-xs font-black uppercase tracking-widest flex items-center gap-2 rounded-sm border border-red-500/20">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Now
                    </span>
                    <span className="text-gray-400 font-black uppercase text-xs">Court {match.courtNumber || '-'}</span>
                  </div>
                  <h3 className="text-xl font-black text-white relative z-10 flex items-center gap-4 mb-2">
                    <span className="truncate">{match.teamA || 'Team A'}</span>
                    <span className="text-gray-600 text-sm">vs</span>
                    <span className="truncate">{match.teamB || 'Team B'}</span>
                  </h3>
                  <div className="text-sm text-[#4D78FF] font-bold tracking-widest uppercase mt-4 flex items-center gap-2 group-hover:translate-x-2 transition-transform relative z-10">
                    Score Match <Play className="w-4 h-4 fill-[#4D78FF]" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback player extraction directly from the string arrays mapped in Firestore
  const extractName = (index: number, teamPlayers: string[]) => {
    return teamPlayers && teamPlayers[index] ? teamPlayers[index] : `Player ${index + 1}`;
  };

  const PLAYERS: Record<PlayerId, LocalPlayer> = {
    p1: { id: 'p1', name: extractName(0, teamA.players), team: 'teamA' },
    p2: { id: 'p2', name: extractName(1, teamA.players), team: 'teamA' },
    p3: { id: 'p3', name: extractName(0, teamB.players), team: 'teamB' },
    p4: { id: 'p4', name: extractName(1, teamB.players), team: 'teamB' },
  };

  const getTennisScore = (pA: number, pB: number, goldenPoint: boolean) => {
    const sequence = ["0", "15", "30", "40"];
    
    if (pA >= 3 && pB >= 3) {
      if (pA === pB) return { a: goldenPoint ? "SP" : "40", b: goldenPoint ? "SP" : "40", label: goldenPoint ? "Star Point" : "Deuce", isDeuce: !goldenPoint };
      if (!goldenPoint) {
        if (pA > pB) return { a: "Ad", b: "40", label: "Advantage A", isDeuce: false };
        if (pB > pA) return { a: "40", b: "Ad", label: "Advantage B", isDeuce: false };
      }
    }
    return { a: sequence[pA] || "0", b: sequence[pB] || "0", label: "", isDeuce: false };
  };

  const scoreDisplay = getTennisScore(matchState.pointsA, matchState.pointsB, matchState.goldenPoint);

  const handleSetServer = (playerId: PlayerId, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMatchState(prev => ({ ...prev, server: playerId }));
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastHistory = history[history.length - 1];
    setMatchState(lastHistory.stateBefore);
    setHistory(prev => prev.slice(0, -1));
  };

  const advanceScore = (teamToAward: TeamId, actionDetails: PointHistory['action']) => {
    let nextState = { ...matchState };

    if (teamToAward === 'teamA') nextState.pointsA += 1;
    else nextState.pointsB += 1;

    const checkGameWin = () => {
      const { pointsA: pA, pointsB: pB, goldenPoint } = nextState;
      if (goldenPoint) {
        if (pA > 3) return 'A';
        if (pB > 3) return 'B';
      } else {
        if (pA >= 4 && pA - pB >= 2) return 'A';
        if (pB >= 4 && pB - pA >= 2) return 'B';
      }
      return null;
    };

    const gWinner = checkGameWin();
    if (gWinner === 'A') {
      nextState.gamesA += 1;
      nextState.pointsA = 0;
      nextState.pointsB = 0;
    } else if (gWinner === 'B') {
      nextState.gamesB += 1;
      nextState.pointsA = 0;
      nextState.pointsB = 0;
    }

    if (nextState.gamesA >= 6) {
      nextState.setsA += 1; nextState.gamesA = 0; nextState.gamesB = 0;
      nextState.server = null;
    } else if (nextState.gamesB >= 6) {
      nextState.setsB += 1; nextState.gamesA = 0; nextState.gamesB = 0;
      nextState.server = null;
    }

    setHistory(prev => [...prev, { stateBefore: matchState, action: actionDetails }]);
    setMatchState(nextState);
  };

  const handleQuickPoint = (playerId: PlayerId) => {
    const team = PLAYERS[playerId].team;
    advanceScore(team, { teamToAward: team, playerId, type: 'point', finisher: 'Generic' });
  };

  const handleTaggedAction = (type: 'winner' | 'error', finisher: FinisherType) => {
    if (!activePlayerForTag) return;
    setHistory(prev => [...prev, {
      stateBefore: matchState,
      action: { playerId: activePlayerForTag, type, finisher, statOnly: true }
    }]);
    setActivePlayerForTag(null);
  };

  const getPlayerStats = (id: PlayerId) => {
    const winners = history.filter(h => h.action.playerId === id && h.action.type === 'winner').length;
    const errors = history.filter(h => h.action.playerId === id && h.action.type === 'error').length;
    return { winners, errors };
  };

  const renderPlayerCard = (id: PlayerId) => {
    const p = PLAYERS[id];
    const isServer = matchState.server === id;
    const stats = getPlayerStats(id);
    const isTeamA = p.team === 'teamA';

    return (
      <div onClick={() => handleQuickPoint(id)} className={`relative flex-1 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-transform active:scale-[0.98] cursor-pointer border ${isTeamA ? 'bg-[#4D78FF]/5 border-[#4D78FF]/20 hover:bg-[#4D78FF]/10' : 'bg-[#E65C31]/5 border-[#E65C31]/20 hover:bg-[#E65C31]/10'}`}>
        <button onClick={(e) => { e.stopPropagation(); handleSetServer(id, e); }} className="absolute top-4 right-4 p-2 rounded-full z-10 bg-transparent">
          <div className={`w-4 h-4 rounded-full border border-white/20 transition-all ${isServer ? isTeamA ? 'bg-[#4D78FF] shadow-[0_0_10px_#4D78FF]' : 'bg-[#E65C31] shadow-[0_0_10px_#E65C31]' : 'bg-[#1A1A1A]'}`} />
        </button>
        <h3 className="text-sm sm:text-base md:text-lg font-black text-white uppercase pr-10 tracking-tight leading-none mt-1 pointer-events-none">{p.name}</h3>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/5 border border-white/10 flex flex-col items-center justify-center shadow-sm`}>
             <Plus className={`w-6 h-6 sm:w-8 sm:h-8 ${isTeamA ? 'text-[#4D78FF]' : 'text-[#E65C31]'}`} strokeWidth={3} />
           </div>
        </div>
        <div className="flex items-end justify-between w-full mt-auto pt-4 relative z-20">
          <div className="flex gap-4 pointer-events-none">
            <div className="flex flex-col">
              <span className="text-[10px] sm:text-xs uppercase font-bold text-gray-500 tracking-widest leading-none mb-1 sm:mb-1.5">Win</span>
              <span className="text-base sm:text-lg font-black text-white leading-none">{stats.winners}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] sm:text-xs uppercase font-bold text-gray-500 tracking-widest leading-none mb-1 sm:mb-1.5">Err</span>
              <span className="text-base sm:text-lg font-black text-white/50 leading-none">{stats.errors}</span>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setActivePlayerForTag(id); }} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#1A1A1A] hover:bg-[#222] border border-white/10 flex items-center justify-center transition-colors shadow-sm">
            <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white/80" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black flex justify-center overflow-hidden">
      {/* <NavigationMenu /> */}
      <div className="w-full max-w-md h-full flex flex-col relative bg-[#0A0A0A] shadow-2xl sm:border-x sm:border-white/5">
        
        <header className="py-2 min-h-[3.5rem] sm:min-h-[4rem] shrink-0 border-b border-white/5 bg-[#111] flex justify-between items-center pl-4 pr-16 z-10 w-full">
          <button onClick={clearSelectedMatch} className="text-gray-400 p-1 hover:text-white transition-colors w-10">
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 sm:gap-3 bg-[#1A1A1A] px-3 py-1.5 rounded-lg border border-white/5">
              <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-gray-400 mt-0.5">Star</span>
              <button onClick={() => setMatchState(prev => ({ ...prev, goldenPoint: !prev.goldenPoint }))} className={`w-8 sm:w-9 h-4 sm:h-5 rounded-full p-0.5 transition-colors relative flex items-center ${matchState.goldenPoint ? 'bg-[#E65C31]' : 'bg-[#222]'}`}>
                <div className={`w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full shadow-sm transition-transform ${matchState.goldenPoint ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            {selectedMatch?.roundName && (
              <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1.5">{selectedMatch.roundName}</span>
            )}
          </div>

          <button onClick={handleUndo} disabled={history.length === 0} className={`p-1.5 rounded w-10 flex justify-end disabled:opacity-30 ${history.length > 0 ? 'text-white' : 'text-gray-600'}`}>
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:rotate-180 transition-transform duration-300" />
          </button>
        </header>

        <section className="h-28 sm:h-32 shrink-0 flex items-center justify-between px-5 sm:px-6 border-b border-white/5 bg-gradient-to-b from-[#111] to-[#0A0A0A] relative z-10">
          <div className="flex flex-col items-start w-[30%]">
            <h2 className="text-xs sm:text-sm font-black text-[#4D78FF] uppercase truncate w-full tracking-tighter drop-shadow-[0_0_8px_rgba(77,120,255,0.4)]">{teamA.name}</h2>
            <div className="flex gap-1.5 mt-1 sm:mt-2">
               {/* Team A Score Logic (Sets/Games) */}
              <div className="flex flex-col items-center">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-gray-600 font-bold mb-0.5">Set</span>
                <span className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center font-bold font-mono text-sm sm:text-base rounded shadow-inner ${matchState.setsA > matchState.setsB ? 'bg-[#4D78FF]/20 text-[#4D78FF] border border-[#4D78FF]/50' : 'bg-[#1A1A1A] text-white border border-white/10'}`}>{matchState.setsA}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-gray-600 font-bold mb-0.5">Gm</span>
                <span className="w-8 h-8 sm:w-9 sm:h-9 bg-[#111] text-white flex items-center justify-center font-bold font-mono text-sm sm:text-base rounded border border-white/5 shadow-inner">{matchState.gamesA}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center w-[40%] mt-2 relative">
            <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest absolute -top-8 sm:-top-9 whitespace-nowrap opacity-90 ${(scoreDisplay.label === 'Advantage B' || scoreDisplay.isDeuce || matchState.goldenPoint) ? 'text-[#E65C31]' : scoreDisplay.label === 'Advantage A' ? 'text-[#4D78FF]' : 'text-transparent'}`}>
              {scoreDisplay.label || '-'}
            </span>
            <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
              <span className={`text-5xl sm:text-6xl leading-[0.8] font-black tracking-tighter ${scoreDisplay.label === 'Advantage A' || scoreDisplay.isDeuce ? 'text-[#E65C31]' : 'text-white'}`}>{scoreDisplay.a}</span>
              <span className="text-white/20 text-3xl font-light -mt-2">-</span>
              <span className={`text-5xl sm:text-6xl leading-[0.8] font-black tracking-tighter ${scoreDisplay.label === 'Advantage B' || scoreDisplay.isDeuce ? 'text-[#E65C31]' : 'text-white'}`}>{scoreDisplay.b}</span>
            </div>
          </div>

          <div className="flex flex-col items-end w-[30%]">
            <h2 className="text-xs sm:text-sm font-black text-[#E65C31] uppercase truncate w-full text-right tracking-tighter drop-shadow-[0_0_8px_rgba(230,92,49,0.4)]">{teamB.name}</h2>
            <div className="flex gap-1.5 mt-1 sm:mt-2 flex-row-reverse">
              {/* Team B Score Logic (Sets/Games) */}
              <div className="flex flex-col items-center">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-gray-600 font-bold mb-0.5">Set</span>
                <span className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center font-bold font-mono text-sm sm:text-base rounded shadow-inner ${matchState.setsB > matchState.setsA ? 'bg-[#E65C31]/20 text-[#E65C31] border border-[#E65C31]/50' : 'bg-[#1A1A1A] text-white border border-white/10'}`}>{matchState.setsB}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-gray-600 font-bold mb-0.5">Gm</span>
                <span className="w-8 h-8 sm:w-9 sm:h-9 bg-[#111] text-white flex items-center justify-center font-bold font-mono text-sm sm:text-base rounded border border-white/5 shadow-inner">{matchState.gamesB}</span>
              </div>
            </div>
          </div>
        </section>

        <main className="flex-[1] min-h-0 grid grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 relative z-0">
          <div className="flex flex-col gap-3 sm:gap-4 h-full">
            {renderPlayerCard('p1')}
            {renderPlayerCard('p2')}
          </div>
          <div className="flex flex-col gap-3 sm:gap-4 h-full">
            {renderPlayerCard('p3')}
            {renderPlayerCard('p4')}
          </div>
        </main>

        <AnimatePresence>
          {matchState.server === null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-[#111] border border-white/5 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
                <div className="mx-auto w-12 h-12 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-4">
                  <div className="w-3 h-3 bg-[#E65C31] rounded-full animate-ping absolute" />
                  <div className="w-3 h-3 bg-[#E65C31] rounded-full relative" />
                </div>
                <h3 className="text-[#E65C31] text-[10px] font-black tracking-widest uppercase text-center mb-1">Set {matchState.setsA + matchState.setsB + 1} Starting</h3>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-6 leading-none">Who is Serving?</h2>
                <div className="flex flex-col gap-4">
                  <div className="bg-[#1A1A1A] p-3 rounded-2xl border-l-[3px] border-[#4D78FF]">
                    <div className="grid grid-cols-2 gap-2">
                       {/* Team A Serving Options */}
                      {(['p1', 'p2'] as PlayerId[]).map(id => (
                        <button key={id} onClick={() => handleSetServer(id)} className="py-3 bg-[#111] hover:bg-[#4D78FF]/20 border border-white/5 rounded-xl text-xs font-black uppercase text-white transition-colors truncate px-1">
                          {PLAYERS[id].name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#1A1A1A] p-3 rounded-2xl border-l-[3px] border-[#E65C31]">
                    <div className="grid grid-cols-2 gap-2">
                       {/* Team B Serving Options */}
                      {(['p3', 'p4'] as PlayerId[]).map(id => (
                        <button key={id} onClick={() => handleSetServer(id)} className="py-3 bg-[#111] hover:bg-[#E65C31]/20 border border-white/5 rounded-xl text-xs font-black uppercase text-white transition-colors truncate px-1">
                          {PLAYERS[id].name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activePlayerForTag && matchState.server !== null && PLAYERS[activePlayerForTag] && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/80 flex items-end justify-center">
              <div className="absolute inset-0" onClick={() => setActivePlayerForTag(null)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#111] w-full max-h-[85vh] overflow-y-auto border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] relative z-10 flex flex-col">
                <div className="sticky top-0 bg-[#1A1A1A] border-b border-white/5 px-5 py-4 rounded-t-3xl flex justify-between items-center z-10">
                  <div className="flex flex-col">
                     {/* Action Selection for Specific Player */}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#4D78FF] mb-0.5">Tag Detail</span>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">{PLAYERS[activePlayerForTag].name}</h2>
                  </div>
                  <button onClick={() => setActivePlayerForTag(null)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="p-5 pb-8 flex flex-col gap-6">
                  <div>
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-3">
                      <Crown className="w-4 h-4 text-green-500" />
                      <h4 className="text-xs uppercase font-black text-green-500 tracking-widest">Mark as Winner</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                       {/* Aggressive Stroke Finisihers */}
                      {(['Smash', 'Bandeja', 'Volea'] as FinisherType[]).map(type => (
                        <button key={type} onClick={() => handleTaggedAction('winner', type)} className="bg-[#1A1A1A] active:bg-green-500/20 border border-transparent active:border-green-500/50 rounded-xl py-4 flex flex-col items-center transition-colors">
                          <span className="font-black text-xs text-white uppercase tracking-wide">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <h4 className="text-xs uppercase font-black text-red-500 tracking-widest">Mark as Error</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Negative Outcome Finisihers */}
                      {(['Net', 'Wall', 'Out'] as FinisherType[]).map(type => (
                        <button key={type} onClick={() => handleTaggedAction('error', type)} className="bg-[#1A1A1A] active:bg-red-500/20 border border-transparent active:border-red-500/50 rounded-xl py-4 flex flex-col items-center transition-colors">
                          <span className="font-black text-xs text-white uppercase tracking-wide">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
