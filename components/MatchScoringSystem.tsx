import React, { useState, useEffect, useRef } from 'react';
import { ScoreState, Team } from '../types';
import { RotateCcw, ChevronLeft, Crown, AlertCircle, X, Plus, Target, Trophy, Clock, Lock, Loader2, Check } from 'lucide-react';
import { toast } from './Toast';
import { motion, AnimatePresence } from 'motion/react';
import { recordAtomicPoint, undoLastAtomicPoint } from '../services/refereeActions';
import { updateMatchScore } from '../services/storage';

// Similar to new LiveScoringPage's UI/UX, built to replace MatchScoringSystem UI

type PlayerId = 'p1' | 'p2' | 'p3' | 'p4';
type TeamId = 'teamA' | 'teamB';
type FinisherType = 'Smash' | 'Bandeja' | 'Volley' | 'Vibora' | 'Drop Shot' | 'Net' | 'Glass' | 'Double Fault' | 'Grill' | 'Generic';
type MatchResolution = 'normal' | 'early_termination' | 'disqualified' | 'technical';
type WorkflowPhase = 'SCORING' | 'SET_END_PROMPT' | 'WINNER_SELECTION' | 'RESOLUTION_TYPE' | 'FINAL_CONFIRMATION';

interface LocalPlayer {
  id: PlayerId;
  name: string;
  team: TeamId;
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
  isTiebreak: boolean;
  setScoresA: number[];
  setScoresB: number[];
}

export interface PointHistory {
  stateBefore: MatchState;
  timestamp: number;
  action: {
    teamToAward?: TeamId;
    playerId?: PlayerId;
    type?: 'winner' | 'error' | 'point' | 'START_SET_NORMAL' | 'START_SET_SUPER';
    finisher?: FinisherType;
    statOnly?: boolean;
  };
}

export interface MatchScoringSystemProps {
  score: ScoreState;
  mode: 'quickplay' | 'tournament';
  matchId: string;
  tournamentId?: string;
  matchType?: string;
  team1Name: string;
  team2Name: string;
  team1?: Team;
  team2?: Team;
  refereePin?: string;
  isMatchEnded?: boolean;
  onUpdateScore: (newScore: ScoreState) => void;
  onRequestChange?: (req: any) => void;
  onEndMatch?: (winner?: 1 | 2, history?: PointHistory[], extraInfo?: any) => void | Promise<void>;
  onTriggerBroadcast?: (type: string, message: string, subMessage?: string) => void;
  onBack?: () => void;
  onShowBanner?: () => void;
  onResumeMatch?: () => void;
  isAmericano?: boolean;
}

export const MatchScoringSystem: React.FC<MatchScoringSystemProps> = ({
  score, mode, matchId, tournamentId, matchType, team1Name, team2Name, team1, team2, refereePin, isMatchEnded, onUpdateScore, onEndMatch, onTriggerBroadcast, onBack, isAmericano = false, onShowBanner, onResumeMatch
}) => {
  const [americanoTargetPoints, setAmericanoTargetPoints] = useState<number>(() => {
    if (score && (score as any).americanoTargetPoints) return Number((score as any).americanoTargetPoints);
    return 24;
  });
  const [americanoMode, setAmericanoMode] = useState<'first_to' | 'fixed_total'>(() => {
    if (score && (score as any).americanoMode) return (score as any).americanoMode;
    return 'fixed_total';
  });

  const [history, setHistory] = useState<PointHistory[]>(() => {
      if (!score?.history) return [];
      return score.history.map((ev: string) => {
          const parts = ev.split('|');
          const type = parts[0];
          const ts = parseInt(parts[1] || "0");
          const playerId = parseInt(parts[2] || "1");
          const tag = parts[3];
          const finisher = parts[4] as FinisherType;
          
          if (type === 'START_SET_NORMAL' || type === 'START_SET_SUPER') {
              return { timestamp: ts, stateBefore: {} as MatchState, action: { type } as any };
          }
          
          if (type === 'T1' || type === 'T2') {
              return {
                  timestamp: ts,
                  stateBefore: {} as MatchState,
                  action: {
                      teamToAward: type === 'T1' ? 'teamA' : 'teamB',
                      playerId: (type === 'T1' ? (playerId === 1 ? 'p1' : 'p2') : (playerId === 1 ? 'p3' : 'p4')) as PlayerId,
                      type: (tag || 'point') as any,
                      finisher
                  }
               };
          }
          return { timestamp: ts, stateBefore: {} as MatchState, action: { type: 'point' } } as any;
      });
  });
  const [activePlayerForTag, setActivePlayerForTag] = useState<PlayerId | null>(null);
  const [taggingMode, setTaggingMode] = useState<'winner' | 'error' | null>(null);
  const [showEndMatchModal, setShowEndMatchModal] = useState(false);
  const [isSubmittingEndMatch, setIsSubmittingEndMatch] = useState(false);
  
  // Workflow Phases
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>('SCORING');
  const [resolutionType, setResolutionType] = useState<MatchResolution | null>(null);
  const [pendingSetResult, setPendingSetResult] = useState<{ team: TeamId, scoreA: number, scoreB: number } | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<1 | 2 | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [endMatchReason, setEndMatchReason] = useState<'normal'|'walkover'|'forfeit'|'disqualification' | null>(null);

  // Initialize Match State based on ScoreState if present, otherwise default to 0
  const INITIAL_STATE: MatchState = {
    pointsA: score?.rawPointsA || 0,
    pointsB: score?.rawPointsB || 0,
    gamesA: score?.p1Games || 0,
    gamesB: score?.p2Games || 0,
    setsA: score?.p1Sets || 0,
    setsB: score?.p2Sets || 0,
    server: (score?.server as PlayerId | null) || null,
    goldenPoint: score?.goldenPoint || false,
    isTiebreak: score?.isTiebreak || false,
    setScoresA: score?.p1SetScores || [],
    setScoresB: score?.p2SetScores || [],
  };

  const [matchState, setMatchState] = useState<MatchState>(INITIAL_STATE);
  const isLocalUpdateRef = useRef(false);
  const lastLocalActionTimeRef = useRef<number>(0);

  useEffect(() => {
    if (score && !isMatchEnded) {
      const isRecentLocalAction = (Date.now() - lastLocalActionTimeRef.current) < 3000;
      const incScoreLen = score.history?.length || 0;
      const localHistLen = history?.length || 0;

      // Ignore stale incoming score props if local referee action occurred within 3 seconds
      if (isRecentLocalAction && incScoreLen <= localHistLen) {
        return;
      }

      setMatchState(prev => {
        const externalPointsA = parseInt(score.p1Points || '0');
        const externalPointsB = parseInt(score.p2Points || '0');
        
        if (
          (score.p1Sets !== undefined && score.p1Sets !== prev.setsA && !isLocalUpdateRef.current) || 
          (score.p2Sets !== undefined && score.p2Sets !== prev.setsB && !isLocalUpdateRef.current) || 
          (score.p1Games !== undefined && score.p1Games !== prev.gamesA && !isLocalUpdateRef.current) || 
          (score.p2Games !== undefined && score.p2Games !== prev.gamesB && !isLocalUpdateRef.current)
        ) {
          return {
            server: (score.server as PlayerId) || 'p1',
            pointsA: isAmericano ? externalPointsA : (score.rawPointsA ?? prev.pointsA),
            pointsB: isAmericano ? externalPointsB : (score.rawPointsB ?? prev.pointsB),
            gamesA: score.p1Games ?? 0,
            gamesB: score.p2Games ?? 0,
            setsA: score.p1Sets ?? 0,
            setsB: score.p2Sets ?? 0,
            goldenPoint: score.goldenPoint || false,
            isTiebreak: score.isTiebreak || false,
            setScoresA: score.p1SetScores || [],
            setScoresB: score.p2SetScores || [],
          };
        }
        return prev;
      });
    }
  }, [score, isAmericano, isMatchEnded]);

  useEffect(() => {
    if (isMatchEnded) return;
    // Only invoke when internal matchState changes
    const pA = matchState.pointsA;
    const pB = matchState.pointsB;
    
    let strA = "";
    let strB = "";
    
    if (isAmericano) {
      strA = pA.toString();
      strB = pB.toString();
    } else {
      const sequence = ["0", "15", "30", "40"];
      strA = matchState.isTiebreak ? pA.toString() : (sequence[pA] || "0");
      strB = matchState.isTiebreak ? pB.toString() : (sequence[pB] || "0");

      if (!matchState.isTiebreak && pA >= 3 && pB >= 3) {
        if (pA === pB) { strA = "40"; strB = "40"; }
        else if (!matchState.goldenPoint) {
          if (pA > pB) { strA = "Ad"; strB = "40"; }
          if (pB > pA) { strA = "40"; strB = "Ad"; }
        }
      }
    }

    const stringHistory = history.map(h => {
        if (h.action.type === 'START_SET_NORMAL' || h.action.type === 'START_SET_SUPER') {
            return `${h.action.type}|${h.timestamp || Date.now()}`;
        }
        const teamStr = h.action.teamToAward === 'teamA' ? 'T1' : 'T2';
        const playerStr = (h.action.playerId === 'p1' || h.action.playerId === 'p3') ? '1' : '2';
        const typeTag = h.action.type || '';
        return `${teamStr}|${h.timestamp || Date.now()}|${playerStr}|${typeTag}|${h.action.finisher?.toLowerCase() || ''}`;
    });

    const nextScoreState: ScoreState = {
      ...score,
      p1Points: strA,
      p2Points: strB,
      p1Games: matchState.gamesA,
      p2Games: matchState.gamesB,
      p1Sets: matchState.setsA,
      p2Sets: matchState.setsB,
      p1SetScores: matchState.setScoresA,
      p2SetScores: matchState.setScoresB,
      rawPointsA: matchState.pointsA,
      rawPointsB: matchState.pointsB,
      goldenPoint: matchState.goldenPoint,
      isTiebreak: matchState.isTiebreak,
      server: matchState.server,
      history: stringHistory,
      ...({ americanoTargetPoints, americanoMode } as any)
    };

    // Do not dispatch intermediate score updates if we are in the process of submitting the final end match
    if (!isSubmittingEndMatch && !isMatchEnded && isLocalUpdateRef.current) {
        onUpdateScore(nextScoreState);
        isLocalUpdateRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState, isAmericano, americanoTargetPoints, americanoMode]); // intentionally omitting score and onUpdateScore

  const t1Players = team1Name?.split('&').map(s => s.trim()) || [];
  const t2Players = team2Name?.split('&').map(s => s.trim()) || [];

  const PLAYERS: Record<PlayerId, LocalPlayer> = {
    p1: { id: 'p1', name: team1?.player1?.name?.split(' ')[0] || t1Players[0] || 'Player 1', team: 'teamA' },
    p2: { id: 'p2', name: team1?.player2?.name?.split(' ')[0] || t1Players[1] || 'Player 2', team: 'teamA' },
    p3: { id: 'p3', name: team2?.player1?.name?.split(' ')[0] || t2Players[0] || 'Player 3', team: 'teamB' },
    p4: { id: 'p4', name: team2?.player2?.name?.split(' ')[0] || t2Players[1] || 'Player 4', team: 'teamB' },
  };

  const getTennisScore = (pA: number, pB: number, goldenPoint: boolean, isTiebreak: boolean) => {
    if (isTiebreak) {
      const isDeuce = pA === pB && pA > 0;
      let label = isDeuce ? "Tie" : "";
      if (!isDeuce && (pA >= 6 || pB >= 6)) {
        label = pA > pB ? "Set Point A" : "Set Point B";
      }
      return { a: pA.toString(), b: pB.toString(), label, isDeuce, advTeam: pA > pB ? 'A' : (pB > pA ? 'B' : null) };
    }
    const sequence = ["0", "15", "30", "40"];
    if (pA >= 3 && pB >= 3) {
      if (pA === pB) return { a: goldenPoint ? "SP" : "40", b: goldenPoint ? "SP" : "40", label: goldenPoint ? "Star Point" : "Deuce", isDeuce: !goldenPoint, advTeam: null };
      
      if (pA > pB) return { a: "Ad", b: "40", label: "Advantage A", isDeuce: false, advTeam: 'A' };
      if (pB > pA) return { a: "40", b: "Ad", label: "Advantage B", isDeuce: false, advTeam: 'B' };
    }
    return { a: sequence[pA] || "0", b: sequence[pB] || "0", label: "", isDeuce: false, advTeam: null };
  };

  const scoreDisplay = isAmericano 
    ? {
        a: matchState.pointsA.toString(),
        b: matchState.pointsB.toString(),
        label: `Americano Rally Play (Target: ${americanoTargetPoints})`,
        isDeuce: false,
        advTeam: matchState.pointsA === matchState.pointsB ? null : (matchState.pointsA > matchState.pointsB ? 'A' : 'B')
      }
    : getTennisScore(matchState.pointsA, matchState.pointsB, matchState.goldenPoint, matchState.isTiebreak);

  const handleSetServer = (playerId: PlayerId, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    lastLocalActionTimeRef.current = Date.now();
    isLocalUpdateRef.current = true; setMatchState(prev => ({ ...prev, server: playerId }));
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastHistory = history[history.length - 1];
    if (lastHistory.stateBefore && Object.keys(lastHistory.stateBefore).length > 0) {
        lastLocalActionTimeRef.current = Date.now();
        isLocalUpdateRef.current = true; setMatchState(lastHistory.stateBefore);
        setHistory(prev => prev.slice(0, -1));
        
        // Revert the last atomic point in the database (e.g. player stats)
        undoLastAtomicPoint(matchId).catch(err => console.error("Failed to undo atomic point:", err));
    } else {
        toast.warning("Can't undo that point", "It happened in a previous scoring session.");
    }
  };

  const PLAYERS_DB_IDS: Record<PlayerId, string> = {
    p1: team1?.player1?.id || '',
    p2: team1?.player2?.id || '',
    p3: team2?.player1?.id || '',
    p4: team2?.player2?.id || '',
  };

  const advanceScore = (teamToAward: TeamId, actionDetails: PointHistory['action']) => {
    lastLocalActionTimeRef.current = Date.now();
    let nextState = { ...matchState };

    if (teamToAward === 'teamA') nextState.pointsA += 1;
    else nextState.pointsB += 1;

    // Trigger atomic point recording for tournaments
    if (mode === 'tournament' && tournamentId) {
      const scoringTeamMap = teamToAward === 'teamA' ? 'A' : 'B';
      const scoringPlayerDbId = actionDetails.playerId ? (PLAYERS_DB_IDS[actionDetails.playerId] || '') : '';
      const shotType = actionDetails.finisher || 'generic';
      const currentSetNum = (nextState.setsA + nextState.setsB) + 1;
      
      recordAtomicPoint(
         matchId,
         tournamentId,
         currentSetNum,
         scoringTeamMap,
         scoringPlayerDbId || 'unknown',
         shotType.toLowerCase(),
         isAmericano ? nextState.pointsA : nextState.gamesA, // newScoreA
         isAmericano ? nextState.pointsB : nextState.gamesB, // newScoreB
         refereePin || 'unknown'
      ).catch (err => {
          console.error("Failed to commit point atomically:", err);
      });
    }

    if (isAmericano) {
      nextState.gamesA = nextState.pointsA;
      nextState.gamesB = nextState.pointsB;
      nextState.setScoresA = [nextState.pointsA];
      nextState.setScoresB = [nextState.pointsB];
      
      const newHistoryEvent = { stateBefore: matchState, timestamp: Date.now(), action: actionDetails };
      const newHistory = [...history, newHistoryEvent as any];
      setHistory(newHistory);
      isLocalUpdateRef.current = true;
      setMatchState(nextState);

      // Check ending condition
      let isCompleted = false;
      if (americanoMode === 'first_to') {
        if (nextState.pointsA >= americanoTargetPoints || nextState.pointsB >= americanoTargetPoints) {
          isCompleted = true;
        }
      } else { // fixed_total
        if (nextState.pointsA + nextState.pointsB >= americanoTargetPoints) {
          isCompleted = true;
        }
      }

      if (isCompleted) {
        const winnerChoice = nextState.pointsA >= nextState.pointsB ? 1 : 2;
        setSelectedWinnerId(winnerChoice);
        setWorkflowPhase('FINAL_CONFIRMATION');
        setResolutionType('normal');
        onTriggerBroadcast && onTriggerBroadcast('MASCOT_HAPPY', 'MATCH CONCLUDED!', `Final Score: ${nextState.pointsA} - ${nextState.pointsB}`);
      }
      return;
    }

    const checkGameWin = () => {
      if (nextState.isTiebreak) return null;
      const { pointsA: pA, pointsB: pB, goldenPoint } = nextState;
      if (goldenPoint) {
        if (pA > 3 && pA > pB) return 'A';
        if (pB > 3 && pB > pA) return 'B';
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

    const newHistoryEvent = { stateBefore: matchState, timestamp: Date.now(), action: actionDetails };
    const newHistory = [...history, newHistoryEvent as any];
    setHistory(newHistory);
    isLocalUpdateRef.current = true;
    setMatchState(nextState);
  };

  const confirmSetEnd = (startNext: boolean, isTiebreakForNext: boolean = false) => {
    if (!pendingSetResult) return;
    
    let nextState = { ...matchState };
    nextState.setScoresA = [...nextState.setScoresA, pendingSetResult.scoreA];
    nextState.setScoresB = [...nextState.setScoresB, pendingSetResult.scoreB];
    
    if (pendingSetResult.team === 'teamA') {
      nextState.setsA += 1;
    } else {
      nextState.setsB += 1;
    }
    
    nextState.gamesA = 0;
    nextState.gamesB = 0;
    nextState.pointsA = 0;
    nextState.pointsB = 0;
    nextState.server = null;
    nextState.isTiebreak = isTiebreakForNext;

    isLocalUpdateRef.current = true;
    setMatchState(nextState);
    setHistory(prev => [...prev, { stateBefore: matchState, timestamp: Date.now(), action: { teamToAward: pendingSetResult.team, type: 'point' } } as any, ...(startNext ? [{ stateBefore: nextState, timestamp: Date.now() + 1, action: { type: 'START_SET_NORMAL' } } as any] : [])]);
    setPendingSetResult(null);

    // Give it a tiny tick for the state to settle before resetting the UI to scoring,
    // which prevents rapid re-renders from fighting with the external sync.
    setTimeout(() => {
        if (startNext) {
          setWorkflowPhase('SCORING');
        } else {
          setWorkflowPhase('WINNER_SELECTION');
        }
    }, 50);
  };

  const handleQuickPoint = (playerId: PlayerId) => {
    if (isMatchEnded) return;
    const team = PLAYERS[playerId].team;
    advanceScore(team, { teamToAward: team, playerId, type: 'point', finisher: 'Generic' });
  };

  const handleTaggedAction = (type: 'winner' | 'error', finisher: FinisherType) => {
    if (!activePlayerForTag || isMatchEnded) return;

    let teamToAward: TeamId;
    if (type === 'winner') {
       teamToAward = PLAYERS[activePlayerForTag].team;
       onTriggerBroadcast && onTriggerBroadcast('MASCOT_HAPPY', 'WINNER!', `${PLAYERS[activePlayerForTag].name} hit a ${finisher}`);
    } else {
       teamToAward = PLAYERS[activePlayerForTag].team === 'teamA' ? 'teamB' : 'teamA';
       onTriggerBroadcast && onTriggerBroadcast('MASCOT_SAD', 'UNFORCED ERROR', `by ${PLAYERS[activePlayerForTag].name} (${finisher})`);
    }

    advanceScore(teamToAward, { teamToAward, playerId: activePlayerForTag, type, finisher, statOnly: false });
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

    // Determine card background and border styling based on teams
    const activeColorClass = isTeamA 
      ? 'from-[#4D78FF]/8 to-[#4D78FF]/3 border-[#4D78FF]/15' 
      : 'from-[#E65C31]/8 to-[#E65C31]/3 border-[#E65C31]/15';

    const serverGlow = isServer 
      ? (isTeamA ? 'shadow-[0_0_25px_rgba(77,120,255,0.25)] border-[#4D78FF]/65' : 'shadow-[0_0_25px_rgba(230,92,49,0.25)] border-[#E65C31]/65') 
      : '';

    return (
      <div className={`relative flex-1 p-2 sm:p-5 flex flex-col justify-between transition-all duration-300 border bg-gradient-to-br ${activeColorClass} ${serverGlow}`}>
        {/* Top Header Row within the Player Card */}
        <div className="flex justify-between items-center w-full z-10">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSetServer(id, e); }}
            className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
              isServer 
                ? (isTeamA ? 'bg-[#4D78FF] text-black border-[#4D78FF] font-black' : 'bg-[#E65C31] text-black border-[#E65C31] font-black') 
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isServer ? 'bg-black animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-[8px] sm:text-[10px] uppercase tracking-wider font-black">
              {isServer ? 'SERVING' : 'TAP TO SERVE'}
            </span>
          </button>

          {/* Stats Summary Pill */}
          <div className="flex gap-1.5 text-[8px] sm:text-[10px] font-bold text-gray-400 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
            <span>W: <strong className="text-white font-black">{stats.winners}</strong></span>
            <span>E: <strong className="text-white/70 font-black">{stats.errors}</strong></span>
          </div>
        </div>

        {/* Center Section: Player Name */}
        <div className="my-1 sm:my-3 text-center sm:text-left z-10">
          <h3 className="text-sm sm:text-lg md:text-xl font-black text-white uppercase tracking-tight leading-none truncate">
            {p.name}
          </h3>
          <span className="text-[7px] uppercase tracking-widest text-gray-500 font-bold mt-0.5 inline-block">
            {isTeamA ? 'Team A' : 'Team B'}
          </span>
        </div>

        {/* Action Buttons Zone: Scored (Winner) and Error */}
        <div className="grid grid-cols-2 gap-1.5 w-full mt-1.5 z-10">
          {/* Winner button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActivePlayerForTag(id);
              setTaggingMode('winner');
            }}
            className="group flex flex-col items-center justify-center py-1.5 sm:py-3 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 border border-emerald-500/25 active:scale-95 rounded-xl transition-all shadow-md"
          >
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-emerald-500 text-black flex items-center justify-center mb-0.5 sm:mb-1 shadow-sm shadow-emerald-500/20">
              <Check className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
            </div>
            <span className="text-[8px] sm:text-[9px] font-black uppercase text-emerald-400 tracking-wider">
              Scored
            </span>
            <span className="text-[6px] sm:text-[7px] text-emerald-500/75 uppercase tracking-widest font-black">
              Winner
            </span>
          </button>

          {/* Error button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActivePlayerForTag(id);
              setTaggingMode('error');
            }}
            className="group flex flex-col items-center justify-center py-1.5 sm:py-3 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 border border-rose-500/25 active:scale-95 rounded-xl transition-all shadow-md"
          >
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-rose-500 text-black flex items-center justify-center mb-0.5 sm:mb-1 shadow-sm shadow-rose-500/20">
              <X className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
            </div>
            <span className="text-[8px] sm:text-[9px] font-black uppercase text-rose-400 tracking-wider">
              Error
            </span>
            <span className="text-[6px] sm:text-[7px] text-rose-500/75 uppercase tracking-widest font-black">
              Lost Pt
            </span>
          </button>
        </div>

        {/* Quick point fallback */}
        <button 
          type="button"
          onClick={(e) => {
             e.stopPropagation();
             handleQuickPoint(id);
          }}
          className="mt-2 sm:mt-3.5 py-1 sm:py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all text-center"
        >
          Quick Point (+1)
        </button>
      </div>
    );
  };

  const handleManualAction = (targetPhase: 'SET_END_PROMPT' | 'WINNER_SELECTION') => {
    let winnerTeam: TeamId = matchState.gamesA >= matchState.gamesB ? 'teamA' : 'teamB';
    if (matchState.gamesA === matchState.gamesB) {
        winnerTeam = matchState.pointsA >= matchState.pointsB ? 'teamA' : 'teamB';
    }
    let finalGamesA = matchState.gamesA;
    let finalGamesB = matchState.gamesB;
    if (matchState.isTiebreak) {
      if (winnerTeam === 'teamA') finalGamesA++;
      else finalGamesB++;
    }
    
    if (targetPhase === 'WINNER_SELECTION') {
        const defaultWinnerChoice = (matchState.setsA > matchState.setsB) ? 1 : 
                              (matchState.setsB > matchState.setsA) ? 2 : 
                              (matchState.gamesA >= matchState.gamesB) ? 1 : 2;
        setSelectedWinnerId(defaultWinnerChoice as 1 | 2);
        setWorkflowPhase('WINNER_SELECTION');
    } else {
        setPendingSetResult({ team: winnerTeam, scoreA: finalGamesA, scoreB: finalGamesB });
        setWorkflowPhase('SET_END_PROMPT');
    }
  };

  return (
    <div className="relative w-full min-h-full md:h-full flex flex-col bg-black overflow-y-auto md:overflow-hidden pb-12 md:pb-0">
      <div className="w-full flex justify-center py-2 bg-[#1A1A1A] hidden">
         <div className="w-12 h-1.5 rounded-full bg-white/20" />
      </div>

      <div className="w-full flex flex-col relative bg-[#0A0A0A] min-h-full md:h-full overflow-y-auto md:overflow-hidden">
        
        <header className="py-2 min-h-[3.5rem] sm:min-h-[4rem] shrink-0 border-b border-white/5 bg-[#111] flex justify-between items-center px-4 z-10 w-full relative">
          
          <div className="flex items-center w-24">
            {onBack && (
              <button 
                onClick={onBack} 
                className="text-[10px] font-bold tracking-wider uppercase text-[#4D78FF] hover:text-white flex items-center shrink-0 bg-[#4D78FF]/10 hover:bg-[#4D78FF]/20 px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                 <ChevronLeft size={16} className="mr-0.5" /> BACK
              </button>
            )}
          </div>
          
          <div className="flex flex-col items-center justify-center gap-1 flex-1 px-2">
            {isAmericano ? (
              <div className="flex flex-wrap items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-[#1A1A1A] border border-white/5">
                <span className="text-[9px] font-black tracking-wider uppercase text-[#E65C31] mr-1">Americano</span>
                
                <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                  <span>Target:</span>
                  <select 
                    value={americanoTargetPoints} 
                    onChange={(e) => setAmericanoTargetPoints(Number(e.target.value))}
                    className="bg-black border border-white/10 text-white rounded px-1.5 py-0.5 text-[9px] focus:outline-none focus:border-[#4D78FF]"
                  >
                    {[12, 16, 21, 24, 32, 40].map(pt => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                  <span>Rule:</span>
                  <select 
                    value={americanoMode} 
                    onChange={(e) => setAmericanoMode(e.target.value as any)}
                    className="bg-black border border-white/10 text-white rounded px-1.5 py-0.5 text-[9px] focus:outline-none focus:border-[#4D78FF]"
                  >
                    <option value="fixed_total">Fixed (Sum)</option>
                    <option value="first_to">First to</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex gap-1.5 w-full max-w-[180px]">
                  <button 
                    type="button"
                    onClick={() => { isLocalUpdateRef.current = true; setMatchState(prev => ({ ...prev, goldenPoint: !prev.goldenPoint })); }} 
                    className={`flex items-center gap-1 bg-[#1A1A1A] px-2.5 py-1.5 rounded-lg border transition-all duration-300 flex-1 justify-center ${
                      matchState.goldenPoint 
                        ? 'bg-gradient-to-r from-amber-500/20 to-[#E65C31]/20 border-[#E65C31] text-[#E65C31] shadow-[0_0_12px_rgba(230,92,49,0.25)] animate-pulse' 
                        : 'border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Trophy size={11} className={`${matchState.goldenPoint ? 'text-[#E65C31]' : 'text-gray-400'}`} />
                    <span className="text-[9px] font-black tracking-wider uppercase">Star Pt</span>
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => { isLocalUpdateRef.current = true; setMatchState(prev => ({ ...prev, isTiebreak: !prev.isTiebreak })); }} 
                    className={`flex items-center gap-1 bg-[#1A1A1A] px-2.5 py-1.5 rounded-lg border transition-all duration-300 flex-1 justify-center ${
                      matchState.isTiebreak 
                        ? 'bg-gradient-to-r from-blue-500/20 to-[#4D78FF]/20 border-[#4D78FF] text-[#4D78FF] shadow-[0_0_12px_rgba(77,120,255,0.25)]' 
                        : 'border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Clock size={11} className={`${matchState.isTiebreak ? 'text-[#4D78FF]' : 'text-gray-400'}`} />
                    <span className="text-[9px] font-black tracking-wider uppercase">Tie Brk</span>
                  </button>
              </div>
            )}
            {matchType && (
              <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center whitespace-nowrap">{matchType}</span>
            )}
          </div>

          <div className="flex items-center justify-end w-24 gap-2">
            {tournamentId && (
              <button 
                onClick={() => {
                   const obsUrl = `https://matchup.com.pk/#obs/${tournamentId}/${matchId}`;
                   navigator.clipboard.writeText(obsUrl);
                   toast.success('OBS link copied', obsUrl);
                }} 
                className="text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-transparent border border-white/20 hover:bg-white/5 py-1.5 px-2 rounded-lg flex items-center transition-colors whitespace-nowrap hidden sm:flex"
              >
                 COPY OBS
              </button>
            )}
            <button onClick={handleUndo} disabled={history.length === 0} className={`p-1.5 rounded disabled:opacity-30 flex justify-end ${history.length > 0 ? 'text-white' : 'text-gray-600'}`}>
              <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 hover:rotate-180 transition-transform duration-300" />
            </button>
          </div>
        </header>

        {/* Manual End Match Button if not ended yet */}
        {!isMatchEnded && workflowPhase === 'SCORING' && (
            <div className="w-full bg-[#111] border-b border-white/5 py-2 px-4 flex justify-between items-center z-10 shrink-0">
               {/* Mobile-only OBS Link */}
               {tournamentId && (
                  <button 
                    onClick={() => {
                       const obsUrl = `https://matchup.com.pk/#obs/${tournamentId}/${matchId}`;
                       navigator.clipboard.writeText(obsUrl);
                       toast.success('OBS link copied', obsUrl);
                    }}
                    className="flex-1 mr-2 bg-transparent text-white border border-white/20 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-colors text-center sm:hidden block whitespace-nowrap"
                  >
                     OBS Link
                  </button>
               )}
               <button onClick={() => handleManualAction('WINNER_SELECTION')} className="flex-1 mx-2 sm:mx-0 sm:mr-2 bg-red-500/20 text-red-500 border border-red-500/50 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-red-500/30 transition-colors text-center">
                  End Match
               </button>
               {!isAmericano && (
                 <button onClick={() => handleManualAction('SET_END_PROMPT')} className="flex-1 ml-2 bg-[#4D78FF]/20 text-[#4D78FF] border border-[#4D78FF]/50 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-[#4D78FF]/30 transition-colors text-center">
                    Start New Set
                 </button>
               )}
            </div>
        )}

        <section className="h-24 sm:h-32 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-white/5 bg-gradient-to-b from-[#111] to-[#0A0A0A] relative z-10">
          <div className="flex flex-col items-start w-[30%]">
            <h2 className="text-[11px] sm:text-xs md:text-sm font-black text-[#4D78FF] uppercase truncate w-full tracking-tighter drop-shadow-[0_0_8px_rgba(77,120,255,0.4)]">{team1Name}</h2>
            {!isAmericano ? (
              <div className="flex gap-1 mt-1 sm:mt-2">
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] sm:text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Set</span>
                   <span className={`w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center font-bold font-mono text-xs sm:text-lg rounded shadow-inner ${matchState.setsA > matchState.setsB ? 'bg-[#4D78FF]/20 text-[#4D78FF] border border-[#4D78FF]/50' : 'bg-[#1A1A1A] text-white border border-white/10'}`}>{matchState.setsA}</span>
                 </div>
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] sm:text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Gm</span>
                   <span className="w-7 h-7 sm:w-10 sm:h-10 bg-[#111] text-white flex items-center justify-center font-bold font-mono text-xs sm:text-lg rounded border border-white/5 shadow-inner">{matchState.gamesA}</span>
                 </div>
              </div>
            ) : (
              <div className="flex gap-1 mt-1 sm:mt-2">
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] sm:text-[9px] uppercase tracking-widest text-[#E65C31] font-bold mb-0.5">PTS</span>
                   <span className="w-10 h-7 sm:w-14 sm:h-10 bg-[#E65C31]/10 text-[#E65C31] flex items-center justify-center font-black font-mono text-xs sm:text-lg rounded border border-[#E65C31]/30 shadow-inner">
                      {matchState.pointsA}
                   </span>
                 </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center w-[40%] mt-1 sm:mt-2 relative">
            <span className={`text-[8px] sm:text-[11px] font-black uppercase tracking-widest absolute -top-6 sm:-top-9 whitespace-nowrap opacity-90 ${(scoreDisplay.advTeam === 'B' || scoreDisplay.isDeuce || matchState.goldenPoint) ? 'text-[#E65C31]' : scoreDisplay.advTeam === 'A' ? 'text-[#4D78FF]' : 'text-transparent'}`}>
              {scoreDisplay.label || '-'}
            </span>
            <div className="flex items-center justify-center gap-1 sm:gap-3 w-full">
              <span className={`text-2xl sm:text-5xl md:text-6xl leading-[0.8] font-black tracking-tighter ${scoreDisplay.isDeuce ? 'text-[#E65C31]' : scoreDisplay.advTeam === 'A' ? 'text-[#4D78FF]' : 'text-white'}`}>{scoreDisplay.a}</span>
              <span className="text-white/20 text-xl sm:text-3xl font-light -mt-1 sm:-mt-2">-</span>
              <span className={`text-2xl sm:text-5xl md:text-6xl leading-[0.8] font-black tracking-tighter ${scoreDisplay.isDeuce ? 'text-[#E65C31]' : scoreDisplay.advTeam === 'B' ? 'text-[#E65C31]' : 'text-white'}`}>{scoreDisplay.b}</span>
            </div>
          </div>

          <div className="flex flex-col items-end w-[30%]">
            <h2 className="text-[11px] sm:text-xs md:text-sm font-black text-[#E65C31] uppercase truncate w-full text-right tracking-tighter drop-shadow-[0_0_8px_rgba(230,92,49,0.4)]">{team2Name}</h2>
            {!isAmericano ? (
              <div className="flex gap-1 mt-1 sm:mt-2 flex-row-reverse">
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] sm:text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Set</span>
                   <span className={`w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center font-bold font-mono text-xs sm:text-lg rounded shadow-inner ${matchState.setsB > matchState.setsA ? 'bg-[#E65C31]/20 text-[#E65C31] border border-[#E65C31]/50' : 'bg-[#1A1A1A] text-white border border-white/10'}`}>{matchState.setsB}</span>
                 </div>
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] sm:text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Gm</span>
                   <span className="w-7 h-7 sm:w-10 sm:h-10 bg-[#111] text-white flex items-center justify-center font-bold font-mono text-xs sm:text-lg rounded border border-white/5 shadow-inner">{matchState.gamesB}</span>
                 </div>
              </div>
            ) : (
              <div className="flex gap-1 mt-1 sm:mt-2 flex-row-reverse">
                 <div className="flex flex-col items-center">
                   <span className="text-[7px] sm:text-[9px] uppercase tracking-widest text-[#4D78FF] font-bold mb-0.5">PTS</span>
                   <span className="w-10 h-7 sm:w-14 sm:h-10 bg-[#4D78FF]/10 text-[#4D78FF] flex items-center justify-center font-black font-mono text-xs sm:text-lg rounded border border-[#4D78FF]/30 shadow-inner">
                      {matchState.pointsB}
                   </span>
                 </div>
              </div>
            )}
          </div>
        </section>

        <main className="grid grid-cols-2 gap-0 relative z-0 border-y border-white/5 overflow-visible md:overflow-hidden md:flex-[1] min-h-[360px] md:min-h-0">
          <div className="flex flex-col md:h-full border-r border-white/5">
            {renderPlayerCard('p1')}
            <div className="h-[1px] bg-white/5 w-full hidden" />
            {renderPlayerCard('p2')}
          </div>
          <div className="flex flex-col md:h-full">
            {renderPlayerCard('p3')}
            <div className="h-[1px] bg-white/5 w-full hidden" />
            {renderPlayerCard('p4')}
          </div>
        </main>

        <AnimatePresence>
          {!isMatchEnded && matchState.server === null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-[#111] border border-white/5 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
                <div className="mx-auto w-12 h-12 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-4">
                  <div className="w-3 h-3 bg-[#E65C31] rounded-full animate-ping absolute" />
                  <div className="w-3 h-3 bg-[#E65C31] rounded-full relative" />
                </div>
                <h3 className="text-[#E65C31] text-[9px] font-black tracking-widest uppercase text-center mb-1">Set {matchState.setsA + matchState.setsB + 1} Starting</h3>
                <h2 className="text-xl font-black text-white uppercase tracking-tight text-center mb-6 leading-none">Who is Serving?</h2>
                <div className="flex flex-col gap-4">
                  <div className="bg-[#1A1A1A] p-3 rounded-2xl border-l-[3px] border-[#4D78FF]">
                    <div className="grid grid-cols-2 gap-2">
                      {(['p1', 'p2'] as PlayerId[]).map(id => (
                        <button key={id} onClick={() => handleSetServer(id)} className="py-3 bg-[#111] hover:bg-[#4D78FF]/20 border border-white/5 rounded-xl text-xs font-black uppercase text-white transition-colors truncate px-1">
                          {PLAYERS[id].name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#1A1A1A] p-3 rounded-2xl border-l-[3px] border-[#E65C31]">
                    <div className="grid grid-cols-2 gap-2">
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
              <div className="absolute inset-0" onClick={() => { setActivePlayerForTag(null); setTaggingMode(null); }} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#111] w-full max-h-[85vh] overflow-y-auto border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] relative z-10 flex flex-col pb-8">
                <div className="sticky top-0 bg-[#1A1A1A] border-b border-white/5 px-5 py-4 rounded-t-3xl flex justify-between items-center z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#4D78FF] mb-0.5">Tag Detail</span>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">
                      {PLAYERS[activePlayerForTag].name} ({taggingMode === 'winner' ? 'WINNER POINT' : 'UNFORCED ERROR'})
                    </h2>
                  </div>
                  <button onClick={() => { setActivePlayerForTag(null); setTaggingMode(null); }} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                
                {/* Visual Tab Selection inside the Modal */}
                <div className="flex border-b border-white/5 bg-[#141414] p-1.5 gap-1.5 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setTaggingMode('winner')}
                    className={`flex-1 py-3 text-center text-xs font-black uppercase rounded-xl transition-all ${
                      taggingMode === 'winner' 
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                        : 'bg-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    Scored Winner Point
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTaggingMode('error')}
                    className={`flex-1 py-3 text-center text-xs font-black uppercase rounded-xl transition-all ${
                      taggingMode === 'error' 
                        ? 'bg-rose-500 text-black shadow-lg shadow-rose-500/20' 
                        : 'bg-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    Lost Error Point
                  </button>
                </div>

                <div className="p-5 flex flex-col gap-6">
                  {taggingMode === 'winner' ? (
                    <div>
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-3">
                        <Crown className="w-4 h-4 text-green-500 animate-bounce" />
                        <h4 className="text-xs uppercase font-black text-green-500 tracking-widest">Select Shot Type</h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(['Smash', 'Bandeja', 'Volley', 'Vibora', 'Drop Shot', 'Generic'] as FinisherType[]).map(type => (
                          <button key={type} onClick={() => handleTaggedAction('winner', type)} className="bg-white/5 border border-white/15 hover:border-emerald-500/50 hover:bg-emerald-500/10 rounded-2xl py-4 flex flex-col items-center justify-center transition-all">
                            <span className="font-black text-xs text-center text-white uppercase tracking-wide leading-tight">{type}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-3">
                        <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                        <h4 className="text-xs uppercase font-black text-red-500 tracking-widest">Select Error Type</h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(['Net', 'Glass', 'Double Fault', 'Grill', 'Generic'] as FinisherType[]).map(type => (
                          <button key={type} onClick={() => handleTaggedAction('error', type)} className="bg-white/5 border border-white/15 hover:border-rose-500/50 hover:bg-rose-500/10 rounded-2xl py-4 flex flex-col items-center justify-center transition-all">
                            <span className="font-black text-xs text-center text-white uppercase tracking-wide leading-tight">{type}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {workflowPhase !== 'SCORING' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                
                {/* Phase 1: Set End Prompt */}
                {workflowPhase === 'SET_END_PROMPT' && (
                  <div className="text-center">
                    <Trophy className="w-16 h-16 text-brand mx-auto mb-6" />
                    <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Set Concluded!</h2>
                    <p className="text-gray-400 text-xs mb-8">Score: {pendingSetResult?.scoreA} - {pendingSetResult?.scoreB}</p>
                    <div className="flex flex-col gap-4">
                      {matchState.setsA + (pendingSetResult?.team === 'teamA' ? 1 : 0) === 1 && matchState.setsB + (pendingSetResult?.team === 'teamB' ? 1 : 0) === 1 ? (
                        <>
                          <p className="text-xs text-brand font-bold uppercase tracking-widest mb-1">Each team has won 1 set</p>
                          <button 
                            onClick={() => confirmSetEnd(true, true)} 
                            className="py-4 bg-[#E65C31] hover:bg-[#ff7145] text-white font-black uppercase text-sm rounded-xl transition-colors shadow-[0_0_15px_rgba(230,92,49,0.4)]"
                          >
                            Start Super Tie Breaker
                          </button>
                          <button 
                            onClick={() => confirmSetEnd(true, false)} 
                            className="py-4 bg-[#4D78FF] hover:bg-[#5D88FF] text-white font-black uppercase text-sm rounded-xl transition-colors shadow-[0_0_15px_rgba(77,120,255,0.4)]"
                          >
                            Start Normal Set 
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => confirmSetEnd(true)} 
                          className="py-4 bg-[#4D78FF] hover:bg-[#5D88FF] text-white font-black uppercase text-sm rounded-xl transition-colors shadow-[0_0_15px_rgba(77,120,255,0.4)]"
                        >
                          Start Next Set
                        </button>
                      )}
                      <button 
                        onClick={() => confirmSetEnd(false)} 
                        className="py-4 bg-[#1A1A1A] hover:bg-[#222] border border-white/10 text-white font-black uppercase text-sm rounded-xl transition-colors"
                      >
                        End Match
                      </button>
                    </div>
                  </div>
                )}

                {/* Phase 2: Winner Selection */}
                {workflowPhase === 'WINNER_SELECTION' && (
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight text-center mb-2">Match Winner</h2>
                    <p className="text-content-secondary text-[10px] text-center mb-8">Force select the winning team to finalize stats.</p>
                    <div className="flex flex-col gap-4">
                      <button 
                        onClick={() => { setSelectedWinnerId(1); setWorkflowPhase('RESOLUTION_TYPE'); }} 
                        className="p-6 bg-[#4D78FF]/10 border border-[#4D78FF]/30 hover:border-[#4D78FF] rounded-2xl transition-all group"
                      >
                        <span className="block text-[10px] font-black uppercase tracking-widest text-[#4D78FF] mb-1 group-hover:scale-110 transition-transform">Team A</span>
                        <span className="text-lg font-black text-white uppercase tracking-tight">{team1Name}</span>
                      </button>
                      <button 
                        onClick={() => { setSelectedWinnerId(2); setWorkflowPhase('RESOLUTION_TYPE'); }} 
                        className="p-6 bg-[#E65C31]/10 border border-[#E65C31]/30 hover:border-[#E65C31] rounded-2xl transition-all group"
                      >
                        <span className="block text-[10px] font-black uppercase tracking-widest text-[#E65C31] mb-1 group-hover:scale-110 transition-transform">Team B</span>
                        <span className="text-lg font-black text-white uppercase tracking-tight">{team2Name}</span>
                      </button>
                    </div>
                    <button 
                      onClick={() => setWorkflowPhase('SCORING')} 
                      className="mt-6 w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase text-xs rounded-xl transition-all tracking-wider text-center block"
                    >
                      Cancel and Go Back
                    </button>
                  </div>
                )}

                {/* Phase 3: Resolution Classification */}
                {workflowPhase === 'RESOLUTION_TYPE' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">Match Resolution</h2>
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Select the victory method</p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {[
                        { id: 'normal', label: 'Normal Win', desc: 'Standard point completion' },
                        { id: 'early_termination', label: 'Early Termination', desc: 'Injury, illness, or forfeit' },
                        { id: 'disqualified', label: 'Team Disqualified', desc: 'Code violations or misconduct' },
                        { id: 'technical', label: 'Technical Win', desc: 'Walkover / Non-appearance' }
                      ].map(res => (
                        <button 
                          key={res.id}
                          onClick={() => { setResolutionType(res.id as MatchResolution); setWorkflowPhase('FINAL_CONFIRMATION'); }}
                          className={`p-4 rounded-xl border transition-all text-left group ${resolutionType === res.id ? 'bg-brand/10 border-brand' : 'bg-[#1A1A1A] border-white/5 hover:border-brand/30'}`}
                        >
                          <span className={`block text-sm font-black uppercase mb-0.5 ${resolutionType === res.id ? 'text-brand' : 'text-white'}`}>{res.label}</span>
                          <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">{res.desc}</span>
                        </button>
                      ))}
                    </div>

                    <button onClick={() => setWorkflowPhase('WINNER_SELECTION')} className="text-xs text-brand font-black uppercase tracking-widest flex items-center gap-1">
                       <ChevronLeft size={14} /> Back
                    </button>
                  </div>
                )}

                {/* Phase 4: Final Confirmation */}
                {workflowPhase === 'FINAL_CONFIRMATION' && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand/20">
                        <Trophy className="text-brand w-8 h-8" />
                      </div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">Summary</h2>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-[#1A1A1A] p-4 rounded-2xl border border-white/5">
                        <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Winner Team</span>
                        <div className="flex items-center gap-3">
                           <div className={`w-2 h-8 rounded-full ${selectedWinnerId === 1 ? 'bg-[#4D78FF]' : 'bg-[#E65C31]'}`} />
                           <span className="text-xl font-black text-white uppercase">{selectedWinnerId === 1 ? team1Name : team2Name}</span>
                        </div>
                      </div>

                      <div className="bg-[#1A1A1A] p-4 rounded-2xl border border-white/5">
                        <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Resolution Method</span>
                        <span className="text-base font-black text-brand uppercase tracking-tight">{resolutionType?.replace('_', ' ')}</span>
                      </div>

                      <div className="bg-[#1A1A1A] p-4 rounded-2xl border border-white/5">
                        <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Final Score</span>
                        <div className="flex gap-2 mb-4 overflow-x-auto custom-scrollbar pb-2">
                           {matchState.setScoresA.map((s, i) => (
                             <div key={i} className="flex flex-col items-center min-w-[3rem] bg-black/40 rounded-lg p-2 border border-white/5">
                                <span className="text-[10px] font-bold text-gray-600 mb-1">{isAmericano ? 'Points' : `Set ${i+1}`}</span>
                                <span className="text-base font-mono font-bold text-white leading-none">{s}-{matchState.setScoresB[i]}</span>
                             </div>
                           ))}
                        </div>
                        <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Referee Notes (Optional)</span>
                        <textarea 
                           className="w-full bg-black/40 text-white rounded-xl border border-white/10 p-3 text-sm focus:outline-none focus:border-brand transition-colors h-24"
                           placeholder="Record injuries, warnings, or special circumstances here..."
                           id="refereeNotes"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-6">
                      <button 
                        disabled={isSubmitting}
                        onClick={async () => {
                          if (isSubmitting) return;
                          if (onEndMatch) {
                            setIsSubmitting(true);
                            try {
                              const notes = (document.getElementById('refereeNotes') as HTMLTextAreaElement)?.value || '';
                              
                              // We calculate the final sets on the fly to avoid premature state mutation
                              let finalSetScoresA = [...matchState.setScoresA];
                              let finalSetScoresB = [...matchState.setScoresB];
                              
                              // Determine if there is an ongoing set with played games or points
                              if (!isAmericano && (matchState.gamesA > 0 || matchState.gamesB > 0 || matchState.pointsA > 0 || matchState.pointsB > 0)) {
                                  // Append the current active set games
                                  let finalGamesA = matchState.gamesA;
                                  let finalGamesB = matchState.gamesB;
                                  
                                  // If we ended in a tiebreak, award an extra game to the winner of the tiebreak
                                  if (matchState.isTiebreak) {
                                      const winnerTeam: TeamId = matchState.pointsA >= matchState.pointsB ? 'teamA' : 'teamB';
                                      if (winnerTeam === 'teamA') finalGamesA++;
                                      else finalGamesB++;
                                  }
                                  
                                  finalSetScoresA.push(finalGamesA);
                                  finalSetScoresB.push(finalGamesB);
                              }
                              await (onEndMatch as any)(selectedWinnerId, history, {
                                 resolution: resolutionType,
                                 scores: { a: finalSetScoresA, b: finalSetScoresB },
                                 gamesA: matchState.gamesA,
                                 gamesB: matchState.gamesB,
                                 pointsA: matchState.pointsA,
                                 pointsB: matchState.pointsB,
                                 refereeNotes: notes ? [notes] : []
                              });
                            } catch (err) {
                               console.error('Failed to submit match end:', err);
                               toast.error("Couldn't finish the match", "Please try again.");
                            } finally {
                              setIsSubmitting(false);
                            }
                          }
                        }}
                        className="w-full py-5 bg-brand text-black font-black uppercase text-sm rounded-2xl transition-all shadow-[0_0_30px_rgba(180,252,87,0.3)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                      >
                        {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                        {isSubmitting ? 'Submitting...' : 'Confirm and Submit'}
                      </button>
                      <button disabled={isSubmitting} onClick={() => setWorkflowPhase('RESOLUTION_TYPE')} className="text-xs text-content-muted font-bold uppercase tracking-widest text-center py-2 disabled:opacity-50">
                         Go Back and Edit
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEndMatchModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">End Match</h2>
                  <button onClick={() => { setShowEndMatchModal(false); setEndMatchReason(null); setSelectedWinnerId(null); }} className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {!endMatchReason ? (
                  <div className="flex flex-col gap-3">
                    <button onClick={() => setEndMatchReason('normal')} className="bg-[#1A1A1A] hover:bg-[#222] border border-white/5 rounded-xl p-4 text-left transition-colors">
                      <span className="block text-sm font-black text-white uppercase mb-1">Won by Normal Play</span>
                      <span className="block text-xs text-gray-500">Match concluded naturally.</span>
                    </button>
                    <button onClick={() => setEndMatchReason('walkover')} className="bg-[#1A1A1A] hover:bg-[#222] border border-white/5 rounded-xl p-4 text-left transition-colors">
                      <span className="block text-sm font-black text-white uppercase mb-1">Walk over Win</span>
                      <span className="block text-xs text-gray-500">Opponent absent. Score recorded as 6-0, 6-0.</span>
                    </button>
                    <button onClick={() => setEndMatchReason('forfeit')} className="bg-[#1A1A1A] hover:bg-[#222] border border-white/5 rounded-xl p-4 text-left transition-colors">
                      <span className="block text-sm font-black text-white uppercase mb-1">Forfeit Win</span>
                      <span className="block text-xs text-gray-500">Opponent retired. Current score stands.</span>
                    </button>
                    <button onClick={() => setEndMatchReason('disqualification')} className="bg-[#1A1A1A] hover:bg-[#222] border border-white/5 rounded-xl p-4 text-left transition-colors">
                      <span className="block text-sm font-black text-white uppercase mb-1">Disqualification</span>
                      <span className="block text-xs text-gray-500">Opponent disqualified. Score recorded as 6-0, 6-0.</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <button onClick={() => setEndMatchReason(null)} className="text-xs text-content-muted flex items-center gap-1 w-max">
                      <ChevronLeft className="w-4 h-4" /> Back to Reasons
                    </button>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center mt-2">Select Winner</h3>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => setSelectedWinnerId(1)} 
                        className={`p-4 rounded-xl border-2 transition-all font-black uppercase text-center ${selectedWinnerId === 1 ? 'bg-[#4D78FF]/20 border-[#4D78FF] text-[#4D78FF]' : 'bg-[#1A1A1A] border-transparent text-white'}`}
                      >
                        {team1Name}
                      </button>
                      <button 
                        onClick={() => setSelectedWinnerId(2)} 
                        className={`p-4 rounded-xl border-2 transition-all font-black uppercase text-center ${selectedWinnerId === 2 ? 'bg-[#E65C31]/20 border-[#E65C31] text-[#E65C31]' : 'bg-[#1A1A1A] border-transparent text-white'}`}
                      >
                        {team2Name}
                      </button>
                    </div>
                    
                    <button 
                      disabled={!selectedWinnerId || isSubmittingEndMatch}
                      onClick={() => {
                        if (isSubmittingEndMatch) return;
                        // Apply score logic based on reason
                        let finalState = { ...matchState };
                        
                        if (endMatchReason === 'walkover' || endMatchReason === 'disqualification') {
                            finalState.gamesA = 0;
                            finalState.gamesB = 0;
                            finalState.pointsA = 0;
                            finalState.pointsB = 0;
                            if (selectedWinnerId === 1) {
                                finalState.setScoresA = [...finalState.setScoresA, 6, 6];
                                finalState.setScoresB = [...finalState.setScoresB, 0, 0];
                                finalState.setsA += 2;
                            } else {
                                finalState.setScoresA = [...finalState.setScoresA, 0, 0];
                                finalState.setScoresB = [...finalState.setScoresB, 6, 6];
                                finalState.setsB += 2;
                            }
                        }
                        
                        // For Forfeit and Normal Play, current score stands. 
                        // We push current games to sets to close out the current set if it's forfeit?
                        // "Game score whatever the game score is at that point"
                        if (endMatchReason === 'forfeit') {
                            if (!isAmericano) finalState.setScoresA = [...finalState.setScoresA, finalState.gamesA];
                            if (!isAmericano) finalState.setScoresB = [...finalState.setScoresB, finalState.gamesB];
                            if (selectedWinnerId === 1) {
                                finalState.setsA += 1;
                            } else {
                                finalState.setsB += 1;
                            }
                            finalState.gamesA = 0;
                            finalState.gamesB = 0;
                        }

                        if (endMatchReason === 'normal') {
                            if (!isAmericano && (finalState.gamesA > 0 || finalState.gamesB > 0)) {
                                if (!isAmericano) finalState.setScoresA = [...finalState.setScoresA, finalState.gamesA];
                                if (!isAmericano) finalState.setScoresB = [...finalState.setScoresB, finalState.gamesB];
                                if (finalState.gamesA > finalState.gamesB) {
                                    finalState.setsA += 1;
                                } else if (finalState.gamesB > finalState.gamesA) {
                                    finalState.setsB += 1;
                                } else {
                                    if (selectedWinnerId === 1) {
                                        finalState.setsA += 1;
                                    } else {
                                        finalState.setsB += 1;
                                    }
                                }
                                finalState.gamesA = 0;
                                finalState.gamesB = 0;
                            }
                        }

                        isLocalUpdateRef.current = true;
                        setMatchState(finalState);
                        setIsSubmittingEndMatch(true);
                        
                        // Wait for state to propagate
                        setTimeout(async () => {
                           if (onEndMatch) {
                               try {
                                   await onEndMatch(selectedWinnerId as 1 | 2, history, {
                                       resolution: endMatchReason,
                                       scores: {
                                           a: finalState.setScoresA,
                                           b: finalState.setScoresB
                                       },
                                       gamesA: finalState.gamesA,
                                       gamesB: finalState.gamesB,
                                       pointsA: finalState.pointsA,
                                       pointsB: finalState.pointsB
                                   });
                                   setShowEndMatchModal(false);
                               } catch (err) {
                                   console.error('Failed to end match:', err);
                                   toast.error("Couldn't end the match", "Please try again.");
                               }
                           }
                           setIsSubmittingEndMatch(false);
                        }, 100);
                      }}
                      className="mt-6 w-full flex items-center justify-center space-x-2 py-4 bg-red-500 hover:bg-red-600 text-white font-black uppercase text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingEndMatch ? (
                        <>
                           <Loader2 className="w-5 h-5 animate-spin" />
                           <span>Ending Match...</span>
                        </>
                      ) : (
                         <span>Confirm End Match</span>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {isMatchEnded && (
           <div className="absolute inset-0 bg-black/60 z-40 flex items-center justify-center pointer-events-auto">
             <div className="flex flex-col gap-4 w-full max-w-xs px-6">
                <div className="text-center mb-4">
                  <Trophy className="w-12 h-12 text-brand mx-auto mb-2 opacity-50" />
                  <h3 className="text-white font-black uppercase text-lg italic tracking-widest">Match Finished</h3>
                  <p className="text-gray-400 text-xs">This match has been recorded.</p>
                </div>
                
                {onShowBanner && (
                  <button 
                    onClick={onShowBanner}
                    className="w-full py-4 bg-brand text-black font-black uppercase text-sm rounded-xl transition-all shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    View Result Card
                  </button>
                )}

                {onResumeMatch && (
                  <button 
                    onClick={onResumeMatch}
                    className="w-full py-4 bg-white/5 border border-white/10 text-white font-black uppercase text-sm rounded-xl hover:bg-white/10 transition-all"
                  >
                    Resume Match
                  </button>
                )}

                {onBack && (
                   <button 
                    onClick={onBack}
                    className="w-full py-4 text-gray-500 font-bold uppercase text-xs tracking-widest"
                  >
                    Back to List
                  </button>
                )}
             </div>
           </div>
        )}
      </div>
    </div>
  );
};
