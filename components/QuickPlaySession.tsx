import React, { useState, useEffect, useRef } from 'react';
import { Card } from './ui/Card';
import { subscribeToQuickplaySessionV2, updateQuickplaySessionV2, incrementGlobalMatches, updatePlayerStats } from '../services/storage';
import { Trophy, Plus, CheckCircle2, Loader2, MapPin, Clock, Award, ChevronLeft, X, Play, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { addPoint } from '../services/scoreEngine';
import { MatchStatus } from '../types';
import { ScorecardTemplate } from './ScorecardTemplate';
import { toPng } from 'html-to-image';
import { MatchScoringSystem } from './MatchScoringSystem';

import { WinnerBanner } from './WinnerBanner';

const INITIAL_SCORE = {
  p1Points: '0',
  p2Points: '0',
  p1Games: 0,
  p2Games: 0,
  p1Sets: 0,
  p2Sets: 0,
  p1SetScores: [],
  p2SetScores: [],
  currentSet: 1,
  isTiebreak: false,
  history: []
};

export const QuickPlaySession: React.FC = () => {
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [team1Selection, setTeam1Selection] = useState<number[]>([]);
  const [team2Selection, setTeam2Selection] = useState<number[]>([]);
  const scorecardRef = useRef<HTMLDivElement>(null);
  
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState({ court: 3, match: 3, overall: 3 });
  const [selectedWinnerBannerMatch, setSelectedWinnerBannerMatch] = useState<any>(null);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const sessionId = hashParams.get('session');

    if (!sessionId) {
      setLoading(false);
      return;
    }

    const unsub = subscribeToQuickplaySessionV2(sessionId, (data) => {
      setSession(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // Disable timeout logic as requested
  }, [session?.status, session?.type]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const feedbacks = [
    { level: 1, label: 'Terrible', emoji: '😡' },
    { level: 2, label: 'Bad', emoji: '😞' },
    { level: 3, label: 'Okay', emoji: '😐' },
    { level: 4, label: 'Good', emoji: '🙂' },
    { level: 5, label: 'Excellent', emoji: '🤩' },
  ];

  const getNextRotation = (players: any[], matchCount: number) => {
    const n = players.length;
    if (n === 8) {
      // 8-player Americano: 7 rounds, 2 matches per round.
      // matchCount will just be the total matches so far. Since we add 2 per round, 
      // roundCount = Math.floor(matchCount / 2).
      const roundCount = Math.floor(matchCount / 2) % 7;
      const k = roundCount;
      const pairs = [
        [0, k + 1],
        [(k + 1) % 7 + 1, (k + 6) % 7 + 1],
        [(k + 2) % 7 + 1, (k + 5) % 7 + 1],
        [(k + 3) % 7 + 1, (k + 4) % 7 + 1]
      ];
      // If it's the first match of the round:
      if (matchCount % 2 === 0) {
        return { t1: pairs[0], t2: pairs[3] }; // e.g., (0,1) vs (4,5)
      } else {
        return { t1: pairs[1], t2: pairs[2] }; // e.g., (2,7) vs (3,6)
      }
    } else if (n === 4) {
      const rotations = [
        { t1: [0, 1], t2: [2, 3] },
        { t1: [0, 2], t2: [1, 3] },
        { t1: [0, 3], t2: [1, 2] }
      ];
      return rotations[matchCount % 3];
    } else if (n === 5) {
      // One player sits out each time
      // Match 0: 0,1 vs 2,3 (4 sits)
      // Match 1: 1,2 vs 3,4 (0 sits)
      // Match 2: 2,3 vs 4,0 (1 sits)
      // Match 3: 3,4 vs 0,1 (2 sits)
      // Match 4: 4,0 vs 1,2 (3 sits)
      const sitOut = matchCount % 5;
      const active = [];
      for (let i = 0; i < 5; i++) {
        if (i !== sitOut) active.push(i);
      }
      return { t1: [active[0], active[1]], t2: [active[2], active[3]] };
    } else if (n === 6) {
      // Two players sit out
      // Simple rotation: sit out (0,1), then (2,3), then (4,5)
      const sitOutGroup = matchCount % 3;
      const active = [];
      if (sitOutGroup === 0) active.push(2, 3, 4, 5);
      else if (sitOutGroup === 1) active.push(0, 1, 4, 5);
      else active.push(0, 1, 2, 3);
      
      // Mix teams within active group
      const subRotation = Math.floor(matchCount / 3) % 3;
      if (subRotation === 0) return { t1: [active[0], active[1]], t2: [active[2], active[3]] };
      if (subRotation === 1) return { t1: [active[0], active[2]], t2: [active[1], active[3]] };
      return { t1: [active[0], active[3]], t2: [active[1], active[2]] };
    } else if (n === 7) {
      const sitOutGroup = matchCount % 7;
      const active = [];
      for (let i = 0; i < 7; i++) {
        if (i !== sitOutGroup && i !== (sitOutGroup + 1) % 7 && i !== (sitOutGroup + 2) % 7) {
          active.push(i);
        }
      }
      return { t1: [active[0], active[1]], t2: [active[2], active[3]] };
    }
    return { t1: [0, 1], t2: [2, 3] };
  };

  const handleAddMatch = async () => {
    if (!session || !session.players) return;
    
    if (session.type === 'regular') {
      setShowTeamSelection(true);
      setTeam1Selection([]);
      setTeam2Selection([]);
      return;
    }
    
    const currentMatchCount = (session.matches || []).length;

    // If 8-player Americano, we add a full round (2 simultaneous matches) at once
    if (session.players.length === 8) {
      const r1 = getNextRotation(session.players, currentMatchCount);
      const r2 = getNextRotation(session.players, currentMatchCount + 1);
      
      const newMatches = [r1, r2].map(rotation => {
        const p1 = session.players[rotation.t1[0]].fullName + ' & ' + session.players[rotation.t1[1]].fullName;
        const p2 = session.players[rotation.t2[0]].fullName + ' & ' + session.players[rotation.t2[1]].fullName;
        return {
          matchId: Math.random().toString(36).substr(2, 9),
          player1: p1,
          player2: p2,
          team1Name: p1,
          team2Name: p2,
          team1Players: rotation.t1,
          team2Players: rotation.t2,
          score: { ...INITIAL_SCORE },
          status: MatchStatus.IN_PROGRESS,
          timestamp: new Date().toISOString()
        };
      });

      await updateQuickplaySessionV2(session.id, {
        matches: [...(session.matches || []), ...newMatches]
      });
      return;
    }

    const rotation = getNextRotation(session.players, currentMatchCount);
    await createMatchWithRotation(rotation);
  };

  const createMatchWithRotation = async (rotation: { t1: number[], t2: number[] }) => {
    const p1 = session.players[rotation.t1[0]].fullName + ' & ' + session.players[rotation.t1[1]].fullName;
    const p2 = session.players[rotation.t2[0]].fullName + ' & ' + session.players[rotation.t2[1]].fullName;

    const newMatch = {
      matchId: Math.random().toString(36).substr(2, 9),
      player1: p1,
      player2: p2,
      team1Name: p1,
      team2Name: p2,
      team1Players: rotation.t1,
      team2Players: rotation.t2,
      score: { ...INITIAL_SCORE },
      status: MatchStatus.IN_PROGRESS,
      timestamp: new Date().toISOString()
    };
    await updateQuickplaySessionV2(session.id, {
      matches: [...(session.matches || []), newMatch]
    });
  };

  const handleRegularMatchStart = async () => {
    if (team1Selection.length !== 2 || team2Selection.length !== 2) return;
    setShowTeamSelection(false);
    await createMatchWithRotation({ t1: team1Selection, t2: team2Selection });
  };

  const togglePlayerSelection = (playerIdx: number, team: 1 | 2) => {
    if (team === 1) {
      if (team1Selection.includes(playerIdx)) {
        setTeam1Selection(team1Selection.filter(i => i !== playerIdx));
      } else if (team1Selection.length < 2 && !team2Selection.includes(playerIdx)) {
        setTeam1Selection([...team1Selection, playerIdx]);
      }
    } else {
      if (team2Selection.includes(playerIdx)) {
        setTeam2Selection(team2Selection.filter(i => i !== playerIdx));
      } else if (team2Selection.length < 2 && !team1Selection.includes(playerIdx)) {
        setTeam2Selection([...team2Selection, playerIdx]);
      }
    }
  };

  const handleScoreUpdate = async (matchId: string, team: 1 | 2, playerIdx: 1 | 2) => {
    if (!session) return;
    const newMatches = (session.matches || []).map((m: any) => {
      if (m.matchId === matchId) {
        const currentScore = m.score || { ...INITIAL_SCORE };
        const nextScore = addPoint(currentScore, team, playerIdx);
        
        let status = m.status;
        let winner = m.winner || null;
        
        if (nextScore.p1Sets === 2) {
          status = MatchStatus.COMPLETED;
          winner = 1;
        } else if (nextScore.p2Sets === 2) {
          status = MatchStatus.COMPLETED;
          winner = 2;
        }

        return {
          ...m,
          score: nextScore,
          status,
          ...(winner !== null ? { winner } : {})
        };
      }
      return m;
    });
    await updateQuickplaySessionV2(session.id, { matches: newMatches });
  };

  const submitFeedbackAndEnd = async () => {
    if (!session) return;
    
    // Generate scorecard image
    if (scorecardRef.current) {
      try {
        const dataUrl = await toPng(scorecardRef.current, {
          cacheBust: true,
          pixelRatio: 3,
          skipFonts: false,
          style: {
            transform: 'none',
          }
        });
        
        // Trigger download
        const link = document.createElement('a');
        link.download = `MUP-Scorecard-${session.id.substring(0, 8)}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to generate scorecard image:', err);
      }
    }

    await updateQuickplaySessionV2(session.id, { status: 'completed', feedbackRating });
    await incrementGlobalMatches((session.matches || []).length);

    // Update player stats
    if (session.playerIds && session.matches) {
      const playerStats: Record<string, any> = {};
      session.playerIds.forEach((pid: string) => {
        if (!pid.startsWith('guest_')) {
          playerStats[pid] = { matchesPlayed: 0, wins: 0, losses: 0, setsWon: 0 };
        }
      });

      session.matches.forEach((m: any) => {
        if ((m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED')) {
          const t1Ids = m.team1Players ? m.team1Players.map((index: number) => session.playerIds[index]) : [];
          const t2Ids = m.team2Players ? m.team2Players.map((index: number) => session.playerIds[index]) : [];
          
          t1Ids.forEach((pid: string) => {
            if (playerStats[pid]) {
              playerStats[pid].matchesPlayed++;
              if (m.winner === 1) playerStats[pid].wins++;
              else if (m.winner === 2) playerStats[pid].losses++;
              playerStats[pid].setsWon += parseInt(m.score.p1Sets || '0');
            }
          });
          
          t2Ids.forEach((pid: string) => {
            if (playerStats[pid]) {
              playerStats[pid].matchesPlayed++;
              if (m.winner === 2) playerStats[pid].wins++;
              else if (m.winner === 1) playerStats[pid].losses++;
              playerStats[pid].setsWon += parseInt(m.score.p2Sets || '0');
            }
          });
        }
      });

      for (const pid of Object.keys(playerStats)) {
        if (playerStats[pid].matchesPlayed > 0) {
          await updatePlayerStats(pid, playerStats[pid]);
        }
      }
    }

    window.location.hash = 'landing';
  };

  const handleEndSession = async () => {
    setShowFeedbackModal(true);
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!session) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Session not found.</div>;

  return (
    <div className="w-full p-4 md:p-6 pt-24 md:pt-32 pb-32">
      {/* Off-screen scorecard template for image generation */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <ScorecardTemplate session={session} ref={scorecardRef} />
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-[900] italic text-white uppercase tracking-tight mb-2">
              {session.type === 'casual' ? 'Americano' : session.type === 'tournament' ? 'Mini Tournament' : 'Regular Game'}
            </h1>
            <div className="flex items-center gap-4">
              <p className="text-[#4D78FF] font-bold tracking-widest uppercase text-xs">Session ID: {session.id?.substring(0, 6).toUpperCase()}</p>
              <button 
                onClick={() => window.location.hash = 'landing'}
                className="text-gray-400 hover:text-white text-xs font-bold tracking-widest uppercase transition-colors"
              >
                Return Home
              </button>
            </div>
          </div>
          {session.status === 'active' && (
            <button onClick={handleEndSession} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold uppercase tracking-wider transition-colors shadow-lg shadow-red-500/20">
              End Session
            </button>
          )}
        </div>

        {session.status === 'completed' && (
          <div className="bg-[#4D78FF]/10 border border-[#4D78FF]/30 text-[#4D78FF] p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-[900] italic uppercase tracking-wider">Session Completed</span>
            </div>
            <button 
              onClick={async () => {
                if (scorecardRef.current) {
                  try {
                    const dataUrl = await toPng(scorecardRef.current, {
                      cacheBust: true,
                      pixelRatio: 3,
                      skipFonts: false,
                      style: {
                        transform: 'none',
                      }
                    });
                    const link = document.createElement('a');
                    link.download = `MUP-Scorecard-${session.id.substring(0, 8)}.png`;
                    link.href = dataUrl;
                    link.click();
                  } catch (err) {
                    console.error('Failed to generate scorecard image:', err);
                  }
                }
              }} 
              className="bg-[#4D78FF] hover:bg-[#3b5bdb] text-white px-4 py-2 rounded-xl font-[800] uppercase tracking-wider text-xs transition-colors shadow-lg shadow-[#4D78FF]/20"
            >
              Download PNG
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-[900] italic text-white uppercase tracking-wider">Matches</h2>
              {session.status === 'active' && (session.matches || []).length > 0 && (session.matches || []).length < 4 && (
                <button onClick={handleAddMatch} className="text-[#E65C31] hover:text-[#d45028] text-sm font-[800] uppercase tracking-wider flex items-center gap-1 transition-colors">
                  <Plus className="w-4 h-4" /> Add Match
                </button>
              )}
            </div>

            {(!session.matches || session.matches.length === 0) ? (
              <div className="text-center py-12 bg-[#111111] border border-white/5 rounded-xl shadow-lg flex flex-col items-center justify-center space-y-4">
                <div className="bg-[#1A1A1A] p-4 rounded-full">
                  <Play className="w-8 h-8 text-[#4D78FF] translate-x-0.5" />
                </div>
                <div>
                  <h3 className="text-xl font-[900] italic text-white uppercase tracking-wider mb-2">Ready to Play?</h3>
                  <p className="text-gray-400 font-medium">Create the first match to start live scoring.</p>
                </div>
                {session.status === 'active' && (
                  <button onClick={handleAddMatch} className="mt-4 bg-[#4D78FF] hover:bg-[#3b5bdb] text-white font-[900] italic uppercase tracking-wider py-4 px-8 rounded-xl shadow-lg shadow-[#4D78FF]/20 transition-all flex items-center gap-2 transform active:scale-95">
                    <Plus className="w-5 h-5" /> Start First Match
                  </button>
                )}
              </div>
            ) : (
              (session.matches || []).map((match: any) => (
                <Card key={match.matchId} className="p-4 bg-[#111111] border border-white/5 shadow-lg">
                  <MatchScoringSystem 
                      score={match.score}
                      mode="quickplay"
                      matchId={match.matchId}
                      team1Name={match.player1}
                      team2Name={match.player2}
                      isMatchEnded={(match.status === MatchStatus.COMPLETED || String(match.status).toUpperCase() === 'FINISHED') || session.status === 'completed'}
                      onUpdateScore={async (newScore) => {
                          const newMatches = session.matches.map((m: any) => {
                              if (m.matchId === match.matchId) {
                                  let status = m.status;
                                  let winner = m.winner || null;
                                  if (newScore.p1Sets + newScore.p2Sets === 5 && newScore._isSetCompleted) {
                                      status = MatchStatus.COMPLETED;
                                      winner = newScore.p1Sets > newScore.p2Sets ? 1 : 2;
                                  }
                                  return { ...m, score: newScore, status, ...(winner !== null ? { winner } : {}) };
                              }
                              return m;
                          });
                          const { updateQuickplaySessionV2 } = await import('../services/storage');
                          await updateQuickplaySessionV2(session.id, { matches: newMatches });
                      }}
                      onEndMatch={async (winner?: 1 | 2) => {
                          if (winner !== undefined) {
                              // Only end this specific match
                              const newMatches = session.matches.map((m: any) => {
                                  if (m.matchId === match.matchId) {
                                      return { ...m, status: MatchStatus.COMPLETED, winner };
                                  }
                                  return m;
                              });
                              const { updateQuickplaySessionV2 } = await import('../services/storage');
                              await updateQuickplaySessionV2(session.id, { matches: newMatches });
                          } else {
                              // Auto end quickplay logic triggered from within match (like 5 sets)
                              handleEndSession();
                          }
                      }}
                  />
                  {((match.status === MatchStatus.COMPLETED || String(match.status).toUpperCase() === 'FINISHED') || session.status === 'completed') && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                          <button 
                              onClick={() => setSelectedWinnerBannerMatch(match)}
                              className="w-full bg-[#E65C31]/10 hover:bg-[#E65C31]/20 text-[#E65C31] font-[800] uppercase tracking-wider py-3 rounded-xl border border-[#E65C31]/30 flex items-center justify-center gap-2 transition-colors text-xs shadow-md"
                          >
                              <Trophy size={16} /> Generate Winner Banner
                          </button>
                      </div>
                  )}
                </Card>
              ))
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-6 bg-[#111111] border border-white/5 shadow-lg">
              <h2 className="text-lg font-[900] italic text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#4D78FF]" /> Roster
              </h2>
              <div className="space-y-2">
                {(session.players || []).map((p: any, i: number) => (
                  <div key={i} className="px-4 py-3 bg-[#1A1A1A] rounded-xl text-white font-bold tracking-wide border border-white/5 flex items-center gap-3">
                    <span className="text-[#4D78FF] text-xs uppercase opacity-70">P{i+1}</span>
                    {p.fullName}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {selectedWinnerBannerMatch && (
         <WinnerBanner 
             match={selectedWinnerBannerMatch} 
             tournamentName="QuickPlay Session"
             quickplayPlayers={session.players}
             onClose={() => setSelectedWinnerBannerMatch(null)}
         />
      )}

      {/* Team Selection Modal for Regular Game */}
      {showTeamSelection && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-[#111111] border border-white/5 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-[900] italic text-white uppercase tracking-tight">Select Teams</h2>
              <button onClick={() => setShowTeamSelection(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-[900] text-[#4D78FF] mb-3 uppercase tracking-widest">Team 1 ({team1Selection.length}/2)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {session.players.map((p: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => togglePlayerSelection(i, 1)}
                      disabled={team2Selection.includes(i)}
                      className={`p-4 rounded-xl text-sm font-[800] uppercase tracking-wider transition-all border ${
                        team1Selection.includes(i) 
                          ? 'bg-[#4D78FF] text-white border-[#4D78FF] shadow-lg shadow-[#4D78FF]/30' 
                          : team2Selection.includes(i)
                            ? 'bg-[#1A1A1A] text-gray-600 border-white/5 cursor-not-allowed opacity-50'
                            : 'bg-[#1A1A1A] text-white border-white/10 hover:border-white/20 hover:bg-[#222222]'
                      }`}
                    >
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-[900] text-[#E65C31] mb-3 uppercase tracking-widest">Team 2 ({team2Selection.length}/2)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {session.players.map((p: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => togglePlayerSelection(i, 2)}
                      disabled={team1Selection.includes(i)}
                      className={`p-4 rounded-xl text-sm font-[800] uppercase tracking-wider transition-all border ${
                        team2Selection.includes(i) 
                          ? 'bg-[#E65C31] text-white border-[#E65C31] shadow-lg shadow-[#E65C31]/30' 
                          : team1Selection.includes(i)
                            ? 'bg-[#1A1A1A] text-gray-600 border-white/5 cursor-not-allowed opacity-50'
                            : 'bg-[#1A1A1A] text-white border-white/10 hover:border-white/20 hover:bg-[#222222]'
                      }`}
                    >
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleRegularMatchStart}
                disabled={team1Selection.length !== 2 || team2Selection.length !== 2}
                className="w-full bg-white hover:bg-gray-200 disabled:opacity-50 text-black font-[900] italic uppercase tracking-wider py-4 rounded-xl transition-all mt-8 transform active:scale-95"
              >
                Start Match
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
          <Card className="w-full max-w-md p-6 sm:p-8 text-center bg-[#111111] shadow-2xl shadow-[#E65C31]/20 border border-[#E65C31]/30 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <h2 className="text-2xl font-[900] italic text-white uppercase tracking-tight mb-2">How was your session?</h2>
            <p className="text-gray-400 font-medium mb-6">Rate your experience at {session.venue || 'this court'}.</p>
            
            <div className="space-y-6 mb-8 flex-grow">
              {[
                { key: 'court', label: 'Court Quality', color: '#4D78FF' },
                { key: 'match', label: 'Match Quality', color: '#E65C31' },
                { key: 'overall', label: 'Overall Experience', color: '#10B981' }
              ].map(criteria => (
                <div key={criteria.key} className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-white font-[800] uppercase tracking-widest text-xs">{criteria.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl filter drop-shadow-md">
                        {feedbacks.find(f => f.level === (feedbackRating as any)[criteria.key])?.emoji}
                      </span>
                      <span style={{ color: criteria.color }} className="font-[900] uppercase italic tracking-wider text-xs w-24 text-right">
                        {feedbacks.find(f => f.level === (feedbackRating as any)[criteria.key])?.label}
                      </span>
                    </div>
                  </div>
                  <div className="px-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      step="1"
                      value={(feedbackRating as any)[criteria.key]} 
                      onChange={(e) => setFeedbackRating(prev => ({ ...prev, [criteria.key]: parseInt(e.target.value) }))}
                      className="w-full h-3 bg-[#0A0A0A] rounded-lg appearance-none cursor-pointer accent-[#E65C31] outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="flex-1 border border-white/10 hover:bg-white/5 text-white py-3 rounded-xl font-bold uppercase tracking-wider transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedbackAndEnd}
                className="flex-1 bg-[#E65C31] hover:bg-[#d45028] text-white py-3 rounded-xl font-[800] italic uppercase tracking-wider transition-all shadow-lg shadow-[#E65C31]/20 text-sm"
              >
                Submit & End
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
