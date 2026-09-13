import React, { useState, useEffect } from 'react';
import { subscribeToTournaments, subscribeToTournament, updateMatchScore, addRefereeTag, triggerBroadcastEvent, subscribeToStandings, startMatch, loginReferee, resumeMatch, isTeamInCategory } from '../services/storage';
import { addPoint } from '../services/scoreEngine';
import { Match, MatchStatus, Tournament, SponsorTier } from '../types';
import { Lock, Play, RotateCcw, AlertCircle, Award, Check, X, Trophy, ChevronRight, Edit2, Clock, MapPin, ChevronLeft, Loader2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from './Toast';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Sheet } from './ui/Sheet';
import { Avatar } from './ui/Avatar';
import { Logo } from './ui/Logo';
import { RefereeStartMatchModal } from './RefereeStartMatchModal';
import { MatchScoringSystem } from './MatchScoringSystem';
import { WinnerBanner } from './WinnerBanner';
import { useMatchResult } from '../hooks/useMatchResult';

const activeMatchEnds = new Set<string>();

const ScoringControl = ({ match: initialMatch, teams, tournamentId, isAmericano, onUpdate, onBack, onShowBanner }: any) => {
    const { matchData: liveMatch } = useMatchResult(initialMatch?.id);
    const match = liveMatch || initialMatch;
    const t1 = teams.find((t: any) => t.id === match.team1Id);
    const t2 = teams.find((t: any) => t.id === match.team2Id);
    
    const handleResumeMatch = async () => {
        if (confirm('Are you sure you want to resume this match? This will clear the winner and mark it as live again.')) {
            try {
                await resumeMatch(tournamentId, match.id);
                // The subscription will update the local match state
                onBack(); // Go back so the user sees it as live in the list
            } catch (err) {
                console.error('Failed to resume match:', err);
                toast.error("Couldn't resume the match", "Please try again.");
            }
        }
    };

    // We already have MatchScoringSystem do all the UI
    const handleScoreUpdate = (newScore: any) => {
        if (match.status === MatchStatus.COMPLETED || String(match.status).toUpperCase() === 'FINISHED' || String(match.status).toUpperCase() === 'COMPLETED') return;
        
        let newStatus = match.status;
        if (match.status === MatchStatus.SCHEDULED || String(match.status).toUpperCase() === 'SCHEDULED' || !match.status) {
            newStatus = MatchStatus.IN_PROGRESS;
        }
        
        onUpdate({ ...match, score: newScore, status: newStatus });
    };

    const handleEndMatch = async (winnerIdChoice: 1 | 2, history: any[], extraInfo?: any) => {
        if (activeMatchEnds.has(match.id)) {
            console.log('Match end already in progress for this match');
            return;
        }
        activeMatchEnds.add(match.id);
        
        try {
            let winnerId;
            if (winnerIdChoice === 1) {
                 winnerId = t1?.id || match.team1Id;
            } else {
                 winnerId = t2?.id || match.team2Id;
            }

            const updates: any = { 
                status: MatchStatus.COMPLETED, 
                winnerTeamId: winnerId 
            };

        if (extraInfo) {
            if (extraInfo.resolution) updates.resolutionType = extraInfo.resolution;
            if (extraInfo.refereeNotes) updates.refereeNotes = extraInfo.refereeNotes;
            if (extraInfo.scores) {
                // Update final score state
                const aScores = extraInfo.scores.a || [];
                const bScores = extraInfo.scores.b || [];
                let aSetsWon = 0;
                let bSetsWon = 0;
                aScores.forEach((score: number, index: number) => {
                    const bScore = bScores[index] || 0;
                    if (score > bScore) aSetsWon++;
                    else if (bScore > score) bSetsWon++;
                });

                const stringHistory = history.map(h => {
                    if (typeof h === 'string') return h;
                    if (h.action?.type === 'START_SET_NORMAL' || h.action?.type === 'START_SET_SUPER') {
                        return `${h.action.type}|${h.timestamp || Date.now()}`;
                    }
                    const teamStr = h.action?.teamToAward === 'teamA' ? 'T1' : 'T2';
                    const playerStr = (h.action?.playerId === 'p1' || h.action?.playerId === 'p3') ? '1' : '2';
                    const typeTag = h.action?.type || '';
                    return `${teamStr}|${h.timestamp || Date.now()}|${playerStr}|${typeTag}|${h.action?.finisher?.toLowerCase() || ''}`;
                });

                // Safely determine final game scores, preserving active/existing games or extraInfo points if setScores is empty
                const finalP1Games = aScores.length > 0 
                    ? (aScores[aScores.length - 1] ?? 0)
                    : (extraInfo?.gamesA ?? extraInfo?.pointsA ?? match.score?.p1Games ?? 0);
                const finalP2Games = bScores.length > 0 
                    ? (bScores[bScores.length - 1] ?? 0)
                    : (extraInfo?.gamesB ?? extraInfo?.pointsB ?? match.score?.p2Games ?? 0);

                updates.score = {
                    ...match.score,
                    p1Sets: aSetsWon,
                    p2Sets: bSetsWon,
                    p1SetScores: aScores,
                    p2SetScores: bScores,
                    p1Games: finalP1Games,
                    p2Games: finalP2Games,
                    p1Points: '0',
                    p2Points: '0',
                    rawPointsA: 0,
                    rawPointsB: 0,
                    _isSetCompleted: true,
                    history: stringHistory
                };

            }
        }

        // Always ensure updates.score is populated so completed matches retain full score state
        if (!updates.score) {
            const currentScore = match.score || {};
            const p1SetScores = currentScore.p1SetScores || [];
            const p2SetScores = currentScore.p2SetScores || [];
            let p1Sets = currentScore.p1Sets || 0;
            let p2Sets = currentScore.p2Sets || 0;
            let p1Games = currentScore.p1Games || 0;
            let p2Games = currentScore.p2Games || 0;

            if (p1SetScores.length > 0 && p1Sets === 0 && p2Sets === 0) {
                p1SetScores.forEach((s: number, i: number) => {
                    const os = p2SetScores[i] || 0;
                    if (s > os) p1Sets++;
                    else if (os > s) p2Sets++;
                });
            }
            if (p1Sets === 0 && p2Sets === 0 && p1Games === 0 && p2Games === 0) {
                if (winnerId === match.team1Id || winnerIdChoice === 1) {
                    p1Sets = 1;
                } else if (winnerId === match.team2Id || winnerIdChoice === 2) {
                    p2Sets = 1;
                }
            }

            updates.score = {
                ...currentScore,
                p1Sets,
                p2Sets,
                p1SetScores,
                p2SetScores,
                p1Games,
                p2Games,
                p1Points: '0',
                p2Points: '0',
                _isSetCompleted: true
            };
        }
        
        const normalizePlayer = (p: any, fallbackName: string) => {
            if (!p) return null;
            const id = p.id || p.email || p.phone || p.name?.replace(/\s+/g, '_') || fallbackName.replace(/\s+/g, '_');
            return {
                ...p,
                id,
                name: p.name || fallbackName
            };
        };

        // Extract basic smashes and finishers if history exists
        if (history && history.length > 0) {
            const playerStats: Record<string, {name: string, smashes: number, winners: number, errors: number, finishers: Record<string, number>}> = {};
            const players: any[] = [];
            if (t1) {
                if (t1.player1) {
                    const np = normalizePlayer(t1.player1, `${t1.name}_P1`);
                    if (np) players.push(np);
                }
                if (t1.player2) {
                    const np = normalizePlayer(t1.player2, `${t1.name}_P2`);
                    if (np) players.push(np);
                }
            } else if (match.team1PlayerIds) {
                match.team1PlayerIds.forEach((id: string) => {
                    const pTeam = teams.find((t: any) => t.id === id);
                    if (pTeam) {
                        const np = normalizePlayer(pTeam.player1 || pTeam, pTeam.name);
                        if (np) players.push(np);
                    }
                });
            }
            if (t2) {
                if (t2.player1) {
                    const np = normalizePlayer(t2.player1, `${t2.name}_P1`);
                    if (np) players.push(np);
                }
                if (t2.player2) {
                    const np = normalizePlayer(t2.player2, `${t2.name}_P2`);
                    if (np) players.push(np);
                }
            } else if (match.team2PlayerIds) {
                match.team2PlayerIds.forEach((id: string) => {
                    const pTeam = teams.find((t: any) => t.id === id);
                    if (pTeam) {
                        const np = normalizePlayer(pTeam.player1 || pTeam, pTeam.name);
                        if (np) players.push(np);
                    }
                });
            }

            players.filter(Boolean).forEach((p: any) => {
                playerStats[p.id] = { name: p.name, smashes: 0, winners: 0, errors: 0, finishers: {} };
            });
            
            history.forEach(point => {
                const action = point.action;
                if (!action || !action.playerId || !playerStats[action.playerId]) return;
                
                if (action.type === 'winner') {
                    playerStats[action.playerId].winners++;
                    if (action.finisher) {
                        playerStats[action.playerId].finishers[action.finisher] = (playerStats[action.playerId].finishers[action.finisher] || 0) + 1;
                        if (action.finisher === 'Smash') {
                            playerStats[action.playerId].smashes++;
                        }
                    }
                } else if (action.type === 'error') {
                    playerStats[action.playerId].errors++;
                }
            });
            updates.playerStats = playerStats;
        }

        // 1. Immediately update UI state optimistically & trigger winner banner for instant responsiveness
        onUpdate({ ...match, ...updates });
        if (typeof onShowBanner === 'function') {
            onShowBanner();
        }

        // 2. Perform background database writes asynchronously in parallel without blocking UI
        const { updateMatchDetails } = await import('../services/storage');
        const { completeMatchAndAdvance } = await import('../services/matchCompletion');

        Promise.all([
            completeMatchAndAdvance(match.id, tournamentId, winnerId, 'currentReferee', undefined, updates.score).catch(err => {
                console.error('Failed to commit atomic match resolution:', err);
            }),
            updateMatchDetails(tournamentId, match.id, updates).catch(err => {
                console.error('Failed to update match details:', err);
            })
        ]).finally(() => {
            activeMatchEnds.delete(match.id);
        });

        // 3. Process analytics in background
        if (history && history.length > 0) {
            (async () => {
                try {
                    const { processMatchAnalytics } = await import('../services/analyticsEngine');
                    const players: any[] = [];
                    const teamAIds: string[] = [];
                    const teamBIds: string[] = [];

                    if (t1) {
                        if (t1.player1) {
                            const np = normalizePlayer(t1.player1, `${t1.name}_P1`);
                            if (np) { players.push(np); teamAIds.push(np.id); }
                        }
                        if (t1.player2) {
                            const np = normalizePlayer(t1.player2, `${t1.name}_P2`);
                            if (np) { players.push(np); teamAIds.push(np.id); }
                        }
                    } else if (match.team1PlayerIds) {
                        match.team1PlayerIds.forEach((id: string) => {
                            const pTeam = teams.find((t: any) => t.id === id);
                            if (pTeam) {
                                const np = normalizePlayer(pTeam.player1 || pTeam, pTeam.name);
                                if (np) { players.push(np); teamAIds.push(np.id); }
                            }
                        });
                    }

                    if (t2) {
                        if (t2.player1) {
                            const np = normalizePlayer(t2.player1, `${t2.name}_P1`);
                            if (np) { players.push(np); teamBIds.push(np.id); }
                        }
                        if (t2.player2) {
                            const np = normalizePlayer(t2.player2, `${t2.name}_P2`);
                            if (np) { players.push(np); teamBIds.push(np.id); }
                        }
                    } else if (match.team2PlayerIds) {
                        match.team2PlayerIds.forEach((id: string) => {
                            const pTeam = teams.find((t: any) => t.id === id);
                            if (pTeam) {
                                const np = normalizePlayer(pTeam.player1 || pTeam, pTeam.name);
                                if (np) { players.push(np); teamBIds.push(np.id); }
                            }
                        });
                    }
                    
                    const teamAStr = teamAIds.filter(Boolean).join(',');
                    const teamBStr = teamBIds.filter(Boolean).join(',');
                    
                    await processMatchAnalytics(match.id, tournamentId, history, players.filter(p => p && p.id && p.id !== 'undefined'), teamAStr, teamBStr);
                } catch (err) {
                    console.error('Failed to prepare match analytics:', err);
                }
            })();
        }
        } catch (err) {
            console.error('Match ending failed:', err);
            activeMatchEnds.delete(match.id);
            throw err;
        }
    };

    return (
        <div className="fixed inset-0 top-16 md:top-24 z-50 flex flex-col bg-bg-dark w-full overflow-y-auto md:overflow-hidden">
            <div className="bg-[#111] border-b border-white/5 py-1.5 px-4 flex items-center justify-center gap-2 shrink-0">
                <MapPin size={12} className="text-brand" />
                <span className="text-[10px] font-black uppercase tracking-widest text-brand">Court: {match.court || 'TBD'}</span>
                <span className="w-1 h-1 rounded-full bg-white/20 mx-1"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-content-secondary">{match.roundName || 'Match'}</span>
            </div>
            <div className="flex-1 w-full relative min-h-0 md:h-full">
                <MatchScoringSystem 
                    score={match.score}
                    matchType={match.roundName}
                    mode="tournament"
                    matchId={match.id}
                    tournamentId={tournamentId}
                    team1Name={t1?.name || match.team1Name || 'Team 1'}
                    team2Name={t2?.name || match.team2Name || 'Team 2'}
                    team1={t1}
                    team2={t2}
                    refereePin={match.refereePin || '1234'} // Fallback if missing
                    isMatchEnded={(match.status === MatchStatus.COMPLETED || String(match.status).toUpperCase() === 'FINISHED')}
                    onUpdateScore={handleScoreUpdate}
                    onEndMatch={handleEndMatch}
                    onBack={onBack}
                    isAmericano={isAmericano}
                    onTriggerBroadcast={(type, message, subMessage) => {
                         triggerBroadcastEvent(tournamentId, match.id, {
                             type, message, subMessage, duration: 4000, timestamp: Date.now(), id: Date.now().toString()
                         });
                    }}
                    onRequestChange={async (req) => {
                         const { submitScoreChangeRequest } = await import('../services/storage');
                         await submitScoreChangeRequest(tournamentId, req);
                         toast.success("Change request submitted", "The organiser will review it.");
                    }}
                />
            </div>

            {(match.status === MatchStatus.COMPLETED || String(match.status).toUpperCase() === 'FINISHED') && (
                <div className="absolute inset-0 z-[110] bg-black/90 flex flex-col items-center justify-center p-4">
                    <div className="text-center w-full max-w-sm py-8 bg-surface-panel rounded-3xl border border-brand/50 p-6">
                        <Award size={64} className="mx-auto text-brand mb-4" />
                        <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Match Completed</h3>
                        <p className="text-content-secondary mb-8">Winner: {match.winnerTeamId === t1?.id ? t1?.name : t2?.name}</p>
                        <div className="flex flex-col gap-4 justify-center">
                            <button onClick={onShowBanner} className="bg-brand text-content-inverse px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-brand-light w-full shadow-[0_0_20px_rgba(77,120,255,0.4)]">
                                Generate Winner Banner
                            </button>
                            <button onClick={onBack} className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-white/10 transition-colors">
                                Return to Schedule
                            </button>
                            <button onClick={handleResumeMatch} className="mt-4 text-xs text-red-500 font-bold uppercase tracking-widest hover:underline">
                                Rescore / Resume Match (Accidental End)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export const RefereeInterface: React.FC<{ initialTournamentId?: string, initialAuthenticated?: boolean, onLogout?: () => void }> = ({ initialTournamentId, initialAuthenticated, onLogout }) => {

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(initialTournamentId || null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authenticated, setAuthenticated] = useState(initialAuthenticated || false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [tournamentNotFound, setTournamentNotFound] = useState(false);
  
  useEffect(() => {
    const handleNavDashboard = () => {
        setSelectedTournamentId(null);
        setSelectedMatch(null);
    };
    window.addEventListener('navigate-dashboard', handleNavDashboard);
    return () => window.removeEventListener('navigate-dashboard', handleNavDashboard);
  }, []);
  
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTournament?.categories && selectedTournament.categories.length > 0) {
      const exists = selectedTournament.categories.some(c => c.id === activeCategoryId);
      if (!exists && activeCategoryId === null) {
        setActiveCategoryId(selectedTournament.categories[0].id);
      }
    } else {
      setActiveCategoryId(null);
    }
  }, [selectedTournament, activeCategoryId]);

  // Winner Banner State
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Fetch all tournaments for the selection list
    const unsubscribe = subscribeToTournaments((data) => {
      setTournaments(data);
      setLoadingTournaments(false);
    });
    return () => unsubscribe();
  }, []);

  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    setResolvedId(selectedTournamentId);
  }, [selectedTournamentId]);

  useEffect(() => {
    if (resolvedId) {
      const unsubscribe = subscribeToTournament(resolvedId, (data) => {
        if (data) {
          setSelectedTournament(data);
          setTournamentNotFound(false);
          setSelectedMatch(prevMatch => {
            if (prevMatch) {
              const incMatch = data.matches?.find(m => m.id === prevMatch.id);
              if (!incMatch) return prevMatch;

              // Prevent stale snapshot from overwriting newer local score entries
              const prevHistLen = prevMatch.score?.history?.length || 0;
              const incHistLen = incMatch.score?.history?.length || 0;
              if (prevHistLen > incHistLen) {
                return { ...incMatch, score: prevMatch.score, status: prevMatch.status || incMatch.status, winnerTeamId: prevMatch.winnerTeamId || incMatch.winnerTeamId };
              }
              if ((prevMatch.status === MatchStatus.COMPLETED || String(prevMatch.status).toUpperCase() === 'COMPLETED') && (incMatch.status !== MatchStatus.COMPLETED)) {
                return { ...incMatch, ...prevMatch };
              }
              return incMatch;
            }
            return null;
          });
        } else {
          setTournamentNotFound(true);
        }
      });
      return () => unsubscribe();
    } else {
      setSelectedTournament(null);
    }
  }, [resolvedId]);

  // Authentication
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTournament && passcode === selectedTournament.refereePasscode) {
      try {
        await loginReferee();
        setAuthenticated(true);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't sign in", "Please check your connection and try again.");
      }
    } else {
      toast.error("Invalid passcode", "Double-check the tournament passcode and try again.");
    }
  };

  // 1. Tournament Selection
  if (!selectedTournament) {
      if (tournamentNotFound) {
        return (
            <div className="pb-20 max-w-2xl mx-auto px-4 text-center mt-20 pt-28">
                <div className="h-16 w-16 bg-surface-panel rounded-2xl flex items-center justify-center border border-white/10 shadow-inner mx-auto mb-6">
                    <X className="text-accent-error" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Tournament Not Found</h1>
                <p className="text-content-secondary text-sm">This tournament link may be invalid or expired.</p>
                <button onClick={() => window.location.hash = 'landing'} className="mt-6 text-brand hover:underline font-bold">Return Home</button>
            </div>
        );
      }

      if (initialTournamentId) {
          return (
            <div className="pb-20 max-w-2xl mx-auto px-4 text-center mt-20 pt-28">
                <Loader2 className="animate-spin text-brand mx-auto mb-4" size={32} />
                <h1 className="text-xl font-bold text-white">Loading Details...</h1>
            </div>
          );
      }

      if (loadingTournaments && tournaments.length === 0) {
          return (
              <div className="pb-20 max-w-2xl mx-auto px-4 text-center mt-20 pt-28">
                  <div className="h-16 w-16 bg-surface-panel rounded-2xl flex items-center justify-center border border-white/10 shadow-inner mx-auto mb-6">
                      <Lock className="text-brand" size={32} />
                  </div>
                  <h1 className="text-2xl font-bold text-white mb-2">Loading Tournament</h1>
                  <p className="text-content-secondary text-sm">Please wait while we load tournament data.</p>
              </div>
          );
      }

      return (
        <div className="pb-20 max-w-2xl mx-auto px-4 text-center mt-20 pt-28">
            <div className="h-16 w-16 bg-surface-panel rounded-2xl flex items-center justify-center border border-white/10 shadow-inner mx-auto mb-6">
                <AlertCircle className="text-brand" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Access Link</h1>
            <p className="text-content-secondary mb-6">Please use the exact Referee Link provided by the tournament organizer to score matches.</p>
            <button onClick={() => window.location.hash = 'landing'} className="text-brand hover:underline font-bold">Return Home</button>
        </div>
      );
  }

  // 2. Authentication
  if (!authenticated) {
      return (
          <div className="pb-20 max-w-2xl mx-auto px-4 text-center mt-20 pt-28">
              <div className="h-16 w-16 bg-surface-panel rounded-2xl flex items-center justify-center border border-white/10 shadow-inner mx-auto mb-6">
                  <Lock className="text-brand" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-6">Referee Access</h1>
              <form onSubmit={handleLogin} className="max-w-sm mx-auto">
                <div className="relative mb-4">
                    <input 
                      type={showPasscode ? "text" : "password"}
                      placeholder="Enter Tournament Passcode"
                      className="w-full bg-surface-ground border border-white/10 rounded-lg p-3 pr-12 text-white text-center tracking-widest text-lg focus:border-brand focus:outline-none transition-colors"
                      value={passcode}
                      onChange={e => setPasscode(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPasscode(!showPasscode)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white focus:outline-none">
                        {showPasscode ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedTournamentId(null)} className="px-4 py-3 bg-surface-panel border border-white/10 text-content-secondary hover:text-white font-bold rounded-xl hover:bg-surface-elevated flex-1 transition-all">
                      Back
                    </button>
                    <button type="submit" className="flex-[2] bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-hover transition-colors shadow-lg shadow-brand/20">
                      Enter
                    </button>
                </div>
              </form>
          </div>
      );
  }

  // Match List View
  if (!selectedMatch) {
    const matches = (selectedTournament.matches || []).sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
    
    const isMulti = selectedTournament.categories && selectedTournament.categories.length > 0;

    return (
      <div className="max-w-4xl mx-auto pb-20 px-4 pt-28 md:pt-36">
        <div className="flex justify-between items-center mb-6 pt-6">
            <h2 className="text-xl md:text-2xl font-bold text-white">{selectedTournament.name} Dashboard</h2>
            <button onClick={() => { 
                setAuthenticated(false); 
                setPasscode(''); 
                if (onLogout) onLogout();
            }} className="text-sm bg-surface-ground hover:bg-surface-elevated text-content-secondary hover:text-white px-4 py-2 rounded-lg border border-white/5 transition-all">Logout</button>
        </div>
        
        {isMulti && (
            <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
                {selectedTournament.categories!.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategoryId(cat.id)}
                        className={`px-4 py-2.5 text-sm font-black rounded-xl transition-all uppercase tracking-wider ${
                            activeCategoryId === cat.id
                                ? 'bg-brand text-black shadow-lg shadow-brand/25 scale-[1.02]'
                                : 'bg-surface-panel hover:bg-surface-elevated text-content-secondary hover:text-white border border-white/5'
                        }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>
        )}
        
        {isMulti ? (
            <div className="space-y-6">
                {(() => {
                    const cat = selectedTournament.categories!.find(c => c.id === activeCategoryId) || selectedTournament.categories![0];
                    if (!cat) return null;
                    const catMatches = matches.filter(m => m.categoryId === cat.id);
                    return (
                        <div key={cat.id} className="border border-white/10 rounded-2xl p-6 bg-surface-dark mb-4">
                            <h3 className="text-xl font-bold text-brand mb-4 flex items-center gap-2">
                                <Trophy size={18} /> {cat.name} <span className="text-sm font-normal text-content-muted">Category Dashboard</span>
                            </h3>
                            <RefereeCategoryView 
                                categoryId={cat.id} 
                                categoryMatches={catMatches} 
                                selectedTournament={selectedTournament}
                                setSelectedMatch={setSelectedMatch}
                            />
                        </div>
                    );
                })()}
                {/* Render uncategorized matches as a fallback */}
                {matches.filter(m => !m.categoryId).length > 0 && (
                    <div className="border border-white/10 rounded-2xl p-6 bg-surface-dark opacity-80 mb-4 mt-8">
                          <h3 className="text-xl font-bold text-brand mb-4 flex items-center gap-2">
                              <Trophy size={18} /> General <span className="text-sm font-normal text-content-muted">Uncategorized Matches</span>
                          </h3>
                          <RefereeCategoryView 
                              categoryId={undefined} 
                              categoryMatches={matches.filter(m => !m.categoryId)} 
                              selectedTournament={selectedTournament}
                              setSelectedMatch={setSelectedMatch}
                          />
                    </div>
                )}
            </div>
        ) : (
            <div>
                <RefereeCategoryView 
                    categoryId={undefined} 
                    categoryMatches={matches} 
                    selectedTournament={selectedTournament}
                    setSelectedMatch={setSelectedMatch}
                />
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full relative flex flex-col min-h-screen pt-16 md:pt-24 bg-bg-dark pb-20">
        {showBanner && selectedMatch.winnerTeamId ? (
            <WinnerBanner 
                match={selectedMatch} 
                tournamentName={selectedTournament.name}
                teams={selectedTournament.teams}
                sponsors={selectedTournament.sponsors}
                onClose={() => { setShowBanner(false); setSelectedMatch(null); }} 
            />
        ) : (
            <ScoringControl 
                match={selectedMatch} 
                teams={selectedTournament.teams} 
                tournamentId={selectedTournament.id}
                isAmericano={(() => {
                    const fmt = selectedMatch.categoryId && selectedTournament.categories
                        ? (selectedTournament.categories.find(c => c.id === selectedMatch.categoryId)?.format || selectedTournament.format)
                        : selectedTournament.format;
                    return fmt === 'AMERICANO' || fmt === 'MEXICANO';
                })()}
                onUpdate={(m: Match) => {
                    setSelectedMatch(m);
                    setSelectedTournament(prev => {
                        if (!prev) return prev;
                        const updatedMatches = (prev.matches || []).map(item => item.id === m.id ? { ...item, ...m } : item);
                        return { ...prev, matches: updatedMatches };
                    });
                    updateMatchScore(selectedTournament.id, m.id, m.score, m.status, m.winnerTeamId).catch(() => {});
                }}
                onBack={() => setSelectedMatch(null)}
                onShowBanner={() => setShowBanner(true)}
            />
        )}
    </div>
  );
};

interface RefereeCategoryViewProps {
    categoryId?: string;
    categoryMatches: Match[];
    selectedTournament: Tournament;
    setSelectedMatch: (match: Match | null) => void;
}

const RefereeCategoryView = ({ 
    categoryId, 
    categoryMatches, 
    selectedTournament, 
    setSelectedMatch 
}: RefereeCategoryViewProps) => {
    const acceptedTeams = React.useMemo(() => {
        return (selectedTournament.teams || []).filter((t: any) => 
            t.status === 'ACCEPTED' && 
            (!categoryId || t.categoryId === categoryId)
        );
    }, [selectedTournament.teams, categoryId]);

    const [standings, setStandings] = useState<any[]>(acceptedTeams);
    const [startingMatch, setStartingMatch] = useState<{ match: Match, team1Name: string, team2Name: string } | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!selectedTournament?.id) return;
        const unsub = subscribeToStandings(selectedTournament.id, categoryId || null, (data) => {
            const source = (data && data.length > 0) ? data : (selectedTournament?.teams || acceptedTeams);
            const filtered = source.filter((t: any) => 
                (t.status === 'ACCEPTED' || t.status === 'accepted' || !t.status) && 
                isTeamInCategory(t, categoryId, selectedTournament)
            );
            if (filtered && filtered.length > 0) {
                setStandings(filtered);
            } else {
                setStandings(acceptedTeams);
            }
        }, selectedTournament);
        return () => unsub();
    }, [selectedTournament?.id, categoryId, acceptedTeams, selectedTournament]);

    // Helper to normalize group strings like "Group B" or "B" or extracting from roundName "Group B"
    const getNormalizedGroup = (g: string | undefined, roundName: string | undefined): string | null => {
        if (g && g.trim()) {
            const match = g.match(/group\s+(\w+)/i);
            return (match ? match[1] : g).trim().toUpperCase();
        }
        if (roundName && roundName.toLowerCase().startsWith('group ')) {
            const match = roundName.match(/group\s+(\w+)/i);
            return (match ? match[1] : roundName.replace(/group\s+/i, '')).trim().toUpperCase();
        }
        return null;
    };

    // Group the standings so we know which groups exist
    const standingsGroups = standings.reduce((acc: any, team: any) => {
        const rawGid = team.groupId || 'A';
        const match = rawGid.match(/group\s+(\w+)/i);
        const gid = (match ? match[1] : rawGid).trim().toUpperCase();
        
        if (!acc[gid]) acc[gid] = [];
        acc[gid].push(team);
        return acc;
    }, {});

    // Group the matches
    const matchesByGroup: Record<string, Match[]> = {};
    const knockoutMatchesByRound: Record<string, Match[]> = {};
    
    categoryMatches.forEach(m => {
         // If a match has a 'group' field or looks like a group stage round name
         const lowerStage = (m.stage || '').toLowerCase();
         const isKnockout = lowerStage === 'knockout' || lowerStage === 'brackets' || (m.roundName && m.roundName.toLowerCase().includes('final'));
         
         const mGroup = getNormalizedGroup(m.group, m.roundName);
         if (mGroup && !isKnockout) {
             if (!matchesByGroup[mGroup]) matchesByGroup[mGroup] = [];
             matchesByGroup[mGroup].push(m);
         } else {
             const rName = m.roundName || 'Knockouts / Other';
             if (!knockoutMatchesByRound[rName]) knockoutMatchesByRound[rName] = [];
             knockoutMatchesByRound[rName].push(m);
         }
    });

    const groupKeys = Array.from(new Set([...Object.keys(standingsGroups), ...Object.keys(matchesByGroup)])).sort();

    const renderMatchesList = (matchesToRender: Match[]) => {
        if (matchesToRender.length === 0) return <div className="text-content-muted text-sm py-2">No matches scheduled.</div>;
        return (
            <div className="grid md:grid-cols-2 gap-4">
            {matchesToRender.map(m => {
                const activeFormat = categoryId 
                    ? (selectedTournament.categories?.find(c => c.id === categoryId)?.format || selectedTournament.format) 
                    : selectedTournament.format;
                const isAmericanoFormat = activeFormat === 'AMERICANO' || activeFormat === 'MEXICANO';

                const t1 = m.team1Id ? selectedTournament.teams.find(t => t.id === m.team1Id) : null;
                const t2 = m.team2Id ? selectedTournament.teams.find(t => t.id === m.team2Id) : null;
                const t1Name = t1 ? t1.name : (m.team1Name || (m.team1Id ? 'Unknown' : 'TBD'));
                const t2Name = t2 ? t2.name : (m.team2Name || (m.team2Id ? 'Unknown' : 'TBD'));
                
                const calculateActualSets = (score: any) => {
                    if (!score) return { p1: 0, p2: 0 };
                    let p1 = 0; let p2 = 0;
                    if (score.p1SetScores && score.p2SetScores && score.p1SetScores.length > 0) {
                        score.p1SetScores.forEach((s: number, i: number) => {
                            const os = score.p2SetScores[i] || 0;
                            if (s > os) p1++; else if (os > s) p2++;
                        });
                        return { p1, p2 };
                    }
                    if (score.p1Sets > 0 || score.p2Sets > 0) {
                        return { p1: score.p1Sets || 0, p2: score.p2Sets || 0 };
                    }
                    return { p1: 0, p2: 0 };
                };
                const actualSets = calculateActualSets(m.score);
                
                const p1Sets = actualSets.p1;
                const p2Sets = actualSets.p2;
                const isCompleted = (m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED') || String(m.status).toUpperCase() === 'COMPLETED' || !!m.winnerTeamId;
                const hasSetScores = !!(m.score?.p1SetScores && m.score.p1SetScores.length > 0);
                const hasScore = p1Sets > 0 || p2Sets > 0 || isCompleted || hasSetScores || (m.score?.p1Games || 0) > 0 || (m.score?.p2Games || 0) > 0 || m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE' || String(m.status).toUpperCase() === 'IN_PROGRESS';
                const isScheduled = m.status === MatchStatus.SCHEDULED || !m.status || String(m.status).toUpperCase() === 'SCHEDULED';

                return (
                    <Card key={m.id} variant="panel" onClick={() => {
                        if (isAmericanoFormat) {
                            if (isScheduled) {
                                setStartingMatch({ match: m, team1Name: m.team1Name || 'Team 1', team2Name: m.team2Name || 'Team 2' });
                            } else {
                                setSelectedMatch(m);
                            }
                        } else {
                            if (!m.team1Id || !m.team2Id) {
                                toast.warning("Can't start this match yet", "One or both teams are still TBD - complete the teams first.");
                                return;
                            }
                            const t1Data = selectedTournament.teams.find(t => t.id === m.team1Id);
                            const t2Data = selectedTournament.teams.find(t => t.id === m.team2Id);
                            if (!t1Data || !t2Data) {
                                toast.warning("Can't start this match", "One or both teams are missing from the roster.");
                                return;
                            }
                            if (isScheduled) {
                                setStartingMatch({ match: m, team1Name: t1Data.name, team2Name: t2Data.name });
                            } else {
                                setSelectedMatch(m);
                            }
                        }
                    }} className="p-4 cursor-pointer hover:border-brand transition-colors group mb-3">
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-medium text-brand px-2 py-1 bg-brand/10 rounded uppercase tracking-wider flex items-center gap-1 ${(!m.court || m.court === 'TBD') ? 'opacity-45' : ''}`}>
                                {(!m.court || m.court === 'TBD') ? null : <MapPin size={12} />} {m.court || 'Court TBD'}
                            </span>
                            <span className="text-xs text-content-muted flex items-center gap-1">
                                <Clock size={12} /> {new Date(m.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-ground px-3 py-2 rounded-lg mb-2">
                            <div className="flex flex-col">
                                <div className={`font-bold ${m.winnerTeamId === m.team1Id ? 'text-brand' : 'text-white'}`}>{t1Name}</div>
                                {(t1?.player1?.name || t1?.player2?.name) && (
                                    <div className="text-[10px] text-content-muted">
                                        {t1.player1?.name} {t1.player2?.name ? ` & ${t1.player2.name}` : ''}
                                    </div>
                                )}
                            </div>
                            {hasScore && (
                                <div className="flex gap-1.5 font-mono items-center px-2">
                                    {hasSetScores ? (
                                        <>
                                            {m.score?.p1SetScores?.map((s: number, i: number) => {
                                                const p2s = m.score?.p2SetScores?.[i] ?? 0;
                                                const wonSet = s > p2s;
                                                return (
                                                    <span key={i} className={`px-2 py-0.5 rounded text-xs font-black border ${wonSet ? 'bg-[#4D78FF]/30 text-white border-[#4D78FF]/50' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                                        {s}
                                                    </span>
                                                );
                                            })}
                                            {(p1Sets > 0 || p2Sets > 0) && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ml-1 uppercase ${m.winnerTeamId === m.team1Id ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-white/10 text-gray-300'}`}>
                                                    {p1Sets} {p1Sets === 1 ? 'Set' : 'Sets'}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className={`px-2.5 py-1 rounded-lg text-sm font-mono font-black border ${m.winnerTeamId === m.team1Id ? 'bg-[#4D78FF] text-white border-[#4D78FF]' : 'bg-white/10 text-white border-white/10'}`}>
                                            {m.score?.p1Games || 0}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center bg-surface-ground px-3 py-2 rounded-lg mb-2">
                            <div className="flex flex-col">
                                <div className={`font-bold ${m.winnerTeamId === m.team2Id ? 'text-brand' : 'text-white'}`}>{t2Name}</div>
                                {(t2?.player1?.name || t2?.player2?.name) && (
                                    <div className="text-[10px] text-content-muted">
                                        {t2.player1?.name} {t2.player2?.name ? ` & ${t2.player2.name}` : ''}
                                    </div>
                                )}
                            </div>
                            {hasScore && (
                                <div className="flex gap-1.5 font-mono items-center px-2">
                                    {hasSetScores ? (
                                        <>
                                            {m.score?.p2SetScores?.map((s: number, i: number) => {
                                                const p1s = m.score?.p1SetScores?.[i] ?? 0;
                                                const wonSet = s > p1s;
                                                return (
                                                    <span key={i} className={`px-2 py-0.5 rounded text-xs font-black border ${wonSet ? 'bg-[#4D78FF]/30 text-white border-[#4D78FF]/50' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                                        {s}
                                                    </span>
                                                );
                                            })}
                                            {(p1Sets > 0 || p2Sets > 0) && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ml-1 uppercase ${m.winnerTeamId === m.team2Id ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-white/10 text-gray-300'}`}>
                                                    {p2Sets} {p2Sets === 1 ? 'Set' : 'Sets'}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className={`px-2.5 py-1 rounded-lg text-sm font-mono font-black border ${m.winnerTeamId === m.team2Id ? 'bg-[#4D78FF] text-white border-[#4D78FF]' : 'bg-white/10 text-white border-white/10'}`}>
                                            {m.score?.p2Games || 0}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                            <div className="text-sm text-content-muted">{m.roundName}</div>
                            {(m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE' || String(m.status).toUpperCase() === 'IN_PROGRESS') && !isCompleted && <div className="animate-pulse w-2 h-2 bg-accent-live rounded-full"></div>}
                            {isCompleted && <div className="text-xs bg-surface-elevated px-2 py-1 rounded text-content-secondary">Complete</div>}
                        </div>
                    </Card>
                )
            })}
            </div>
        );
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    return (
        <div className="space-y-6 mb-8 mt-4">
            {startingMatch && (
                <RefereeStartMatchModal
                    tournament={selectedTournament}
                    match={startingMatch.match}
                    team1Name={startingMatch.team1Name}
                    team2Name={startingMatch.team2Name}
                    onClose={() => setStartingMatch(null)}
                    onStart={async (courtId, courtName, conflictAcknowledged) => {
                        const mToStart = startingMatch.match;
                        // FIX (client feedback: failures only showed up in the
                        // console): the modal used to close immediately,
                        // before the write even started, so a failed start
                        // looked identical to a successful one - the referee
                        // had no idea the match never actually went live.
                        // Now it stays open until the write settles; storage.ts
                        // shows a toast on failure so this isn't silent either
                        // way.
                        try {
                            await startMatch(selectedTournament.id, mToStart.id, courtId, courtName, null, conflictAcknowledged);
                            const updatedMatch = {
                                ...mToStart,
                                status: MatchStatus.IN_PROGRESS,
                                courtId: courtId || mToStart.scheduledCourtId || 'TBD',
                                courtName: courtName || 'TBD',
                                court: courtName || 'TBD',
                                actualCourtId: courtId,
                                conflictAcknowledged: conflictAcknowledged || null,
                                obsEnabled: true
                            };
                            setSelectedMatch(updatedMatch);
                        } catch (err) {
                            console.error("Failed to start match", err);
                        } finally {
                            setStartingMatch(null);
                        }
                    }}
                />
            )}
            {groupKeys.length === 0 && Object.keys(knockoutMatchesByRound).length === 0 && (
                 <div className="text-content-muted text-center py-8">No matches or standings available yet.</div>
            )}
            
            {groupKeys.map(gId => {
                const isExpanded = expandedGroups[gId] || false;
                const groupMatches = matchesByGroup[gId] || [];
                
                return (
                    <div key={gId} className="border border-white/5 bg-[#0D0D0D] rounded-2xl overflow-hidden mb-4 shadow-xl">
                        <button 
                            onClick={() => toggleGroup(gId)}
                            className="w-full flex justify-between items-center px-6 py-4 bg-surface-panel hover:bg-surface-elevated transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <Trophy size={20} className="text-brand" />
                                <div>
                                    <h4 className="text-base font-black text-white uppercase tracking-wider leading-none mb-1">
                                        Group {gId}
                                    </h4>
                                    <span className="text-xs text-content-muted font-semibold">
                                        {groupMatches.length} Scheduled Matches
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-brand font-bold uppercase tracking-widest hidden sm:inline">
                                    {isExpanded ? 'Collapse' : 'Expand'}
                                </span>
                                <div className={`p-1.5 rounded-lg bg-white/5 border border-white/5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-brand' : ''}`}>
                                    <ChevronDown size={18} />
                                </div>
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="p-6 bg-black/40 space-y-3 border-t border-white/5">
                                <h5 className="text-xs uppercase tracking-widest text-content-muted font-bold mb-1">Group Matches</h5>
                                {renderMatchesList(groupMatches)}
                            </div>
                        )}
                    </div>
                );
            })}

            {Object.keys(knockoutMatchesByRound).map(rName => (
                <div key={rName} className="space-y-4 pt-4 border-t border-white/10">
                    <h4 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Trophy size={18} className="text-brand" /> {rName} {rName.toLowerCase().includes('grid') ? '' : 'Grid'}
                    </h4>
                    {renderMatchesList(knockoutMatchesByRound[rName])}
                </div>
            ))}
        </div>
    );
};
