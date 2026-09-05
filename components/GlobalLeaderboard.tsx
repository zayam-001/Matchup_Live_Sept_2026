import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../services/storage';
import { Trophy, Activity, Loader2, Target, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { Logo } from './ui/Logo';

interface GlobalPlayer {
    id: string;
    playerName: string;
    playerAvatar?: string;
    gender?: string;
    points: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    placementPoints: number;
    matchWinPoints: number;
    skillPoints: number;
}

export const GlobalLeaderboard: React.FC = () => {
  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'W'>('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!db) return;
      setLoading(true);
      try {
        const lbRef = collection(db, 'leaderboard');
        // We will fetch all for now and sort client side to handle gender if we don't have indexes
        const q = query(lbRef, orderBy('points', 'desc'), limit(100));
        const snap = await getDocs(q);
        
        const data = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                playerName: d.playerName || 'Unknown Player',
                playerAvatar: d.playerAvatar,
                gender: d.gender || 'M',
                points: d.points || 0,
                matchesPlayed: d.matchesPlayed || 0,
                wins: d.wins || 0,
                losses: d.losses || 0,
                placementPoints: d.placementPoints || 0,
                matchWinPoints: d.matchWinPoints || 0,
                skillPoints: d.skillPoints || 0,
            };
        });
        setPlayers(data);
      } catch (err) {
        console.error("Error fetching global leaderboard:", err);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  const filteredPlayers = players.filter(p => genderFilter === 'ALL' || p.gender === genderFilter);

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
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight uppercase leading-none">Global Rankings</h1>
        <p className="text-content-secondary text-lg">All-Time Cumulative Leaderboard</p>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        {(['ALL', 'M', 'W'] as const).map(g => (
          <button
            key={g}
            onClick={() => setGenderFilter(g)}
            className={`px-8 py-3 rounded-full font-bold transition-all ${
              genderFilter === g ? 'bg-primary text-white shadow-[0_4px_14px_0_rgba(77,120,255,0.39)]' : 'bg-surface-dark text-content-muted hover:text-white border border-white/10'
            }`}
          >
            {g === 'ALL' ? 'All' : g === 'M' ? 'Men' : 'Women'}
          </button>
        ))}
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

            {filteredPlayers.map((player, index) => {
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
                    <div className="text-accent font-black md:text-xl w-24 text-right">{player.points}</div>
                    <div className="w-10 flex justify-end text-content-muted">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                      <div className="bg-surface-dark/50 rounded-xl p-4 mx-2 md:mx-4 border border-white/5 grid grid-cols-3 gap-4 text-center mb-2 animate-in fade-in slide-in-from-top-2">
                          <div>
                              <div className="text-xs font-bold text-content-muted uppercase tracking-widest mb-1">Placement</div>
                              <div className="text-lg font-black text-white flex items-center justify-center gap-1"><Trophy className="w-4 h-4 text-yellow-500"/> {player.placementPoints}</div>
                          </div>
                          <div>
                              <div className="text-xs font-bold text-content-muted uppercase tracking-widest mb-1">Match Wins</div>
                              <div className="text-lg font-black text-white flex items-center justify-center gap-1"><Award className="w-4 h-4 text-emerald-500"/> {player.matchWinPoints}</div>
                          </div>
                          <div>
                              <div className="text-xs font-bold text-content-muted uppercase tracking-widest mb-1">Skill</div>
                              <div className="text-lg font-black text-white flex items-center justify-center gap-1"><Target className="w-4 h-4 text-accent"/> {player.skillPoints}</div>
                          </div>
                      </div>
                  )}
                </div>
              );
            })}

            {filteredPlayers.length === 0 && (
               <div className="px-6 py-12 text-center text-content-muted font-medium border-2 border-dashed border-white/5 rounded-2xl">
                  No players found on the global leaderboard.
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
