import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/storage';
import { Trophy, Loader2, Target, Award, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Logo } from './ui/Logo';

interface TournamentPlayer {
    id: string;
    playerName: string;
    playerAvatar?: string;
    gender?: string;
    matchesPlayed: number;
    matchWins: number;
    matchLosses: number;
    skillPoints: number;
    matchWinPoints: number;
    totalPoints: number;
}

export const TournamentLeaderboard: React.FC = () => {
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentName, setTournamentName] = useState<string>('Tournament');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!db) return;
      setLoading(true);
      
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
      const urlHash = window.location.hash.split('?')[0];
      const segments = urlHash.replace(/^#\/?/, '').split('/');
      
      // Support #tournament-leaderboard/ID or #tournament-leaderboard?id=ID
      let tournamentId = segments[1] || hashParams.get('id') || hashParams.get('tournament');

      if (!tournamentId) {
         setLoading(false);
         return;
      }

      try {
        const tRef = doc(db, 'tournaments', tournamentId);
        const tSnap = await getDoc(tRef);
        if (tSnap.exists()) {
           setTournamentName(tSnap.data().name || 'Tournament');
        }

        const lbRef = collection(db, 'tournaments', tournamentId, 'leaderboard');
        const q = query(lbRef, orderBy('totalPoints', 'desc'));
        const snap = await getDocs(q);
        
        const data = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                playerName: data.playerName || 'Unknown Player',
                playerAvatar: data.playerAvatar,
                gender: data.gender || 'M',
                matchesPlayed: data.matchesPlayed || 0,
                matchWins: data.matchWins || 0,
                matchLosses: data.matchLosses || 0,
                skillPoints: data.skillPoints || 0,
                matchWinPoints: data.matchWinPoints || 0,
                totalPoints: data.totalPoints || 0,
            };
        });
        setPlayers(data);
      } catch (err) {
        console.error("Error fetching tournament leaderboard:", err);
      }
      setLoading(false);
    };
    
    fetchLeaderboard();
  }, []);

  const getBorderColor = (index: number) => {
    if (index === 0) return 'border-l-accent';
    if (index === 1) return 'border-l-primary';
    if (index === 2) return 'border-l-content-secondary';
    return 'border-l-transparent border-l-4';
  };

  return (
    <div className="w-full flex-1 flex flex-col pt-28 md:pt-36 pb-32 max-w-5xl mx-auto px-4 md:px-6">
      <div className="text-center mb-12">
        <Logo className="w-16 h-16 mx-auto mb-6 shrink-0" size={64} />
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight uppercase leading-none">{tournamentName}</h1>
        <p className="text-content-secondary text-lg">Live Tournament Leaderboard</p>
        <div className="inline-flex items-center gap-2 mt-4 text-xs font-bold bg-accent-live/10 text-accent-live px-3 py-1.5 rounded-full uppercase tracking-wider">
           <span className="flex h-2 w-2 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-live opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-live"></span>
           </span>
           In Progress
        </div>
      </div>

      <div className="bg-card-dark border border-primary/10 rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
        
        {loading ? (
           <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 relative z-10">
            <div className="flex px-4 py-2 text-xs font-bold text-content-muted uppercase tracking-widest border-b border-primary/10 mb-4">
               <div className="w-8 md:w-12 text-center">Rank</div>
               <div className="flex-1 pl-4">Player</div>
               <div className="hidden md:block w-24 text-center">Matches</div>
               <div className="w-24 text-right">Points</div>
               <div className="w-10"></div>
            </div>

            {players.map((player, index) => {
              const isExpanded = expandedRow === player.id;
              return (
                <div key={player.id} className="flex flex-col gap-2">
                  <div 
                     onClick={() => setExpandedRow(isExpanded ? null : player.id)}
                     className={`cursor-pointer bg-surface-dark rounded-xl p-4 flex items-center md:gap-4 border-l-4 ${getBorderColor(index)} hover:bg-surface-elevated transition-colors border border-transparent`}
                  >
                    <div className="font-black text-content-muted w-8 md:w-12 text-center text-lg">{index + 1}</div>
                    <div className="flex-1 font-bold text-white pl-4 text-sm md:text-base truncate flex items-center gap-3">
                      {player.playerAvatar ? (
                          <img src={player.playerAvatar} alt={player.playerName} className="w-8 h-8 rounded-full border border-white/10" />
                      ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                             <span className="text-xs text-white/50">{player.playerName.charAt(0)}</span>
                          </div>
                      )}
                      {player.playerName}
                    </div>
                    <div className="hidden md:block w-24 text-center text-content-secondary font-medium">{player.matchesPlayed}</div>
                    <div className="text-accent font-black md:text-xl w-24 text-right">{player.totalPoints}</div>
                    <div className="w-10 flex justify-end text-content-muted">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                      <div className="bg-surface-dark/50 rounded-xl p-4 mx-2 md:mx-4 border border-white/5 flex items-center justify-center gap-12 text-center mb-2 animate-in fade-in slide-in-from-top-2">
                          <div>
                              <div className="text-xs font-bold text-content-muted uppercase tracking-widest mb-1">Match Wins</div>
                              <div className="text-lg font-black text-white flex items-center justify-center gap-1"><Award className="w-4 h-4 text-emerald-500"/> {player.matchWinPoints}</div>
                          </div>
                          <div>
                              <div className="text-xs font-bold text-content-muted uppercase tracking-widest mb-1">Skill Shots</div>
                              <div className="text-lg font-black text-white flex items-center justify-center gap-1"><Target className="w-4 h-4 text-accent"/> {player.skillPoints}</div>
                          </div>
                      </div>
                  )}
                </div>
              );
            })}

            {players.length === 0 && (
               <div className="px-6 py-12 flex flex-col items-center justify-center text-content-muted font-medium border-2 border-dashed border-white/5 rounded-2xl gap-4">
                  <AlertCircle className="w-8 h-8" />
                  No stats recorded for this tournament yet.
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
