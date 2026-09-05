import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Logo } from './ui/Logo';
import { Users, Trophy, Play, ArrowRight, Loader2, AlertTriangle, Activity } from 'lucide-react';
import { getCourtByToken, getVenueById, subscribeToGlobalStats } from '../services/storage';
import { useAuth } from '../hooks/useAuth';

export const QuickPlay: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [court, setCourt] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [globalStats, setGlobalStats] = useState({ totalMatches: 0, totalPlayers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    // Safely parse the hash parameters
    let hashString = hash;
    try {
      hashString = decodeURIComponent(hashString);
    } catch (e) {
      // Ignore decode errors
    }
    
    let hashParams = new URLSearchParams();
    
    if (hashString.includes('?')) {
      hashParams = new URLSearchParams(hashString.split('?')[1]);
    }

    const courtId = hashParams.get('court');
    const venueId = hashParams.get('venue');
    const token = hashParams.get('token');

    console.log("Validating QR Params:", { courtId, venueId, token, fullHash: hashString });

    if (!courtId || !venueId || !token) {
      setError(`Invalid QR code URL. Missing parameters.`);
      setLoading(false);
      return;
    }

    const validateQR = async () => {
      setLoading(true);
      setError('');
      try {
        const courtData = await getCourtByToken(token, 'player');
        console.log("Court lookup result:", courtData);

        if (!courtData) {
          setError('This QR code token is not valid.');
          setLoading(false);
          return;
        }

        if (courtData.id !== courtId || (courtData as any).venueId !== venueId) {
          console.error("QR Mismatch:", { 
            urlCourt: courtId, 
            dbCourt: courtData.id, 
            urlVenue: venueId, 
            dbVenue: (courtData as any).venueId 
          });
          setError('This QR code does not match the registered court or venue.');
          setLoading(false);
          return;
        }

        setCourt(courtData);

        const venueData = await getVenueById(venueId);
        if (venueData) setVenue(venueData);

        setLoading(false);
      } catch (e) {
        console.error("Validation error:", e);
        setError('Failed to validate QR code. Please check your connection.');
        setLoading(false);
      }
    };

    validateQR();

    const unsubStats = subscribeToGlobalStats((stats) => {
      setGlobalStats(stats);
    });

    return () => unsubStats();
  }, [hash]);

  const handleAction = (action: 'casual' | 'tournament' | 'regular') => {
    if (!user) {
      sessionStorage.setItem('postAuthRedirect', window.location.hash);
      window.location.hash = 'auth';
      return;
    }
    // Proceed to mode setup
    window.location.hash = `quick-play-setup?mode=${action}&court=${court.id}&venue=${venue.id}`;
  };

  if (loading || authLoading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-500/20 p-6 rounded-full mb-6">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">QR Code Error</h2>
        <p className="text-gray-400 mb-8 max-w-md">{error}</p>
        <div className="flex gap-4">
          <button 
            onClick={() => window.location.hash = 'landing'}
            className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
          >
            Return Home
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="bg-green-500 hover:bg-green-600 text-black px-8 py-3 rounded-xl font-bold transition-colors"
          >
            Retry Scan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center p-4 md:p-6 pt-24 md:pt-32 pb-32">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-4xl font-[900] italic text-white mb-2 tracking-tight uppercase">{court?.courtName}</h1>
          <p className="text-[#4D78FF] font-bold tracking-widest uppercase text-sm">{venue?.name}</p>
        </div>

        <div className="bg-[#111111] border border-white/5 rounded-xl p-4 mb-8 text-center shadow-lg">
          <p className="text-sm font-medium text-gray-400">
            <span className="font-bold text-white">{(globalStats?.totalMatches ?? 0).toLocaleString()}</span> matches played · <span className="font-bold text-white">{(globalStats?.totalPlayers ?? 0).toLocaleString()}</span> players have played
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <button
            onClick={() => handleAction('casual')}
            className="w-full bg-[#1A1A1A] hover:bg-[#222222] border border-white/5 hover:border-white/10 text-white font-bold py-5 px-6 rounded-xl transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-[#4D78FF]/20 p-3 rounded-lg text-[#4D78FF]">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-[800] uppercase tracking-wide">Start Americano</h3>
                <p className="text-sm text-gray-400 font-medium">Always free to play</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => handleAction('regular')}
            className="w-full bg-[#1A1A1A] hover:bg-[#222222] border border-white/5 hover:border-white/10 text-white font-bold py-5 px-6 rounded-xl transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-purple-500/20 p-3 rounded-lg text-purple-400">
                <Activity className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-[800] uppercase tracking-wide">Regular Game</h3>
                <p className="text-sm text-gray-400 font-medium">Pick your own teams and play</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => handleAction('tournament')}
            className="w-full bg-[#E65C31] hover:bg-[#d45028] text-white font-bold py-5 px-6 rounded-xl transition-all flex items-center justify-between group shadow-lg shadow-[#E65C31]/20"
          >
            <div className="flex items-center gap-4">
              <div className="bg-black/20 p-3 rounded-lg text-white">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-[900] italic uppercase tracking-wider">Start Mini Tournament</h3>
                <p className="text-sm text-white/80 font-medium">
                  {user && user.firstMiniTournamentUsed ? 'PKR 100 per session' : 'Free on first use! 🎉'}
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
          </button>
        </div>

        <div className="text-center">
          <a
            href={`#leaderboard?court=${court?.id}&token=${court?.qrToken}`}
            className="text-gray-400 hover:text-white text-sm tracking-widest font-bold uppercase transition-colors"
          >
            View {venue?.name || 'Court'} Leaderboard →
          </a>
        </div>
      </div>
    </div>
  );
};
