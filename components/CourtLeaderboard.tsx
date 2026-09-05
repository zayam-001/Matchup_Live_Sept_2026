import React, { useState, useEffect } from 'react';
import { getCourtLeaderboard, getCourtByToken, getVenueById, subscribeToGlobalStats } from '../services/storage';
import { Trophy, Activity, ArrowLeft, ArrowRight, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { Logo } from './ui/Logo';

export const CourtLeaderboard: React.FC = () => {
  const [court, setCourt] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ totalMatches: 0, totalPlayers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState<'month' | 'all'>('month');

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const courtId = hashParams.get('court');
    const token = hashParams.get('token');

    if (!courtId || !token) {
      setError('Invalid leaderboard URL.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const courtData = await getCourtByToken(token, 'player');
        if (!courtData || courtData.id !== courtId) {
          setError('Leaderboard not available.');
          setLoading(false);
          return;
        }
        setCourt(courtData);

        if (courtData && 'venueId' in courtData && courtData.venueId) {
          const venueData = await getVenueById(courtData.venueId as string);
          setVenue(venueData);
        }

        // Fetching global leaderboard for now, as ELO is global in the current schema
        const data = await getCourtLeaderboard(courtId);
        setLeaderboard(data.slice(0, 10)); // Top 10
        setLoading(false);
      } catch (e) {
        setError('Failed to load leaderboard.');
        setLoading(false);
      }
    };

    fetchData();

    const unsubStats = subscribeToGlobalStats((stats) => {
      setGlobalStats(stats);
    });

    return () => unsubStats();
  }, []);

  if (loading) {
    return <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-accent-error mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Oops!</h2>
        <p className="text-content-secondary">{error}</p>
      </div>
    );
  }

  // Helper colors for top 3
  const getBorderColor = (index: number) => {
    if (index === 0) return 'border-l-accent';
    if (index === 1) return 'border-l-primary';
    if (index === 2) return 'border-l-content-secondary';
    return 'border-l-transparent border-l-4';
  };

  return (
    <div className="w-full flex-1 flex flex-col pt-28 md:pt-36 pb-32 max-w-4xl mx-auto px-4 md:px-6">
      <div className="text-center mb-12">
        <Logo className="w-16 h-16 mx-auto mb-6 shrink-0" size={64} />
        <p className="text-sm font-bold text-primary uppercase tracking-widest mb-3">
          {globalStats.totalMatches.toLocaleString()} MATCHES · {globalStats.totalPlayers.toLocaleString()} PLAYERS
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight uppercase leading-none">{venue?.name || court?.courtName}</h1>
        <p className="text-content-secondary text-lg">Official Venue Leaderboard</p>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setTimeframe('month')}
          className={`px-8 py-3 rounded-full font-bold transition-all ${
            timeframe === 'month' ? 'bg-primary text-white shadow-[0_4px_14px_0_rgba(77,120,255,0.39)]' : 'bg-surface-dark text-content-muted hover:text-white border border-white/10'
          }`}
        >
          This Month
        </button>
        <button
          onClick={() => setTimeframe('all')}
          className={`px-8 py-3 rounded-full font-bold transition-all ${
            timeframe === 'all' ? 'bg-primary text-white shadow-[0_4px_14px_0_rgba(77,120,255,0.39)]' : 'bg-surface-dark text-content-muted hover:text-white border border-white/10'
          }`}
        >
          All Time
        </button>
      </div>

      <div className="bg-card-dark border border-primary/10 rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="flex justify-between items-center mb-8 relative z-10">
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-3">
            Rankings <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-live opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-accent-live"></span></span>
          </h2>
        </div>
        
        <div className="space-y-4 relative z-10">
          <div className="flex px-4 py-2 text-xs font-bold text-content-muted uppercase tracking-widest border-b border-primary/10 mb-4">
             <div className="w-8 md:w-16 text-center">Rank</div>
             <div className="flex-1 pl-4">Player</div>
             <div className="w-20 md:w-32 text-center">Matches</div>
             <div className="w-20 md:w-32 text-center">GWP</div>
             <div className="w-16 md:w-32 text-right">Points</div>
          </div>
          {leaderboard.map((player, index) => {
            const winRate = player.stats?.matchesPlayed > 0 
              ? Math.round((player.stats.wins / player.stats.matchesPlayed) * 100) 
              : 0;
            
            return (
              <div key={player.id} className={`bg-surface-dark rounded-xl p-4 flex items-center md:gap-4 border-l-4 ${getBorderColor(index)} hover:bg-surface-elevated transition-colors border border-transparent`}>
                <div className="font-black text-content-muted w-8 md:w-16 text-center text-lg">{index + 1}</div>
                <div className="flex-1 font-bold text-white pl-4 text-sm md:text-base truncate">{player.fullName}</div>
                <div className="w-20 md:w-32 text-center text-content-secondary font-medium">{player.stats?.matchesPlayed || 0}</div>
                <div className="w-20 md:w-32 flex flex-col items-center gap-1">
                   <div className="w-full max-w-[60px] bg-bg-dark h-[4px] rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-primary" style={{ width: `${winRate}%` }} />
                   </div>
                   <div className="font-bold text-content-secondary text-[10px]">{winRate}%</div>
                </div>
                <div className="text-accent font-black md:text-xl w-16 md:w-32 text-right">{player.stats?.totalPoints || 0}</div>
              </div>
            );
          })}
          {leaderboard.length === 0 && (
             <div className="px-6 py-12 text-center text-content-muted font-medium border-2 border-dashed border-white/5 rounded-2xl">
                No players found for this court yet.
             </div>
          )}
        </div>
      </div>

      <div className="text-center mt-12">
        <a
          href="#onboarding"
          className="inline-flex items-center justify-center gap-2 text-primary hover:text-white font-bold transition-colors bg-surface-dark py-4 px-8 rounded-full border border-primary/20 hover:border-primary uppercase tracking-wider text-sm shadow-[0_0_20px_rgba(77,120,255,0.1)]"
        >
          Sign up to track your stats <ArrowRight className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
};
