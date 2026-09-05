import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Users, Trophy, Play, ArrowRight, Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import { createQuickplaySessionV2 } from '../services/storage';
import { useAuth } from '../hooks/useAuth';

export const QuickPlaySetup: React.FC = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'casual' | 'tournament' | 'regular'>('casual');
  const [players, setPlayers] = useState<string[]>(['', '', '', '']);
  const [courtId, setCourtId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const urlMode = hashParams.get('mode') as 'casual' | 'tournament' | 'regular' || 'casual';
    setMode(urlMode);
    setCourtId(hashParams.get('court') || '');
    setVenueId(hashParams.get('venue') || '');
    
    // Set default player slots based on mode
    let initialPlayers = ['', '', '', ''];
    if (urlMode === 'casual') {
      initialPlayers = ['', '', '', ''];
    }

    setPlayers(initialPlayers);
  }, [user]);

  const handlePlayerChange = (index: number, value: string) => {
    const newPlayers = [...players];
    newPlayers[index] = value;
    setPlayers(newPlayers);
  };

  const addPlayer = () => {
    if (mode === 'casual') {
      if (players.length >= 8) {
        setError("Maximum 8 players are allowed for Americano.");
        return;
      }
    }
    if (mode === 'regular' && players.length >= 4) {
      setError("Regular Game requires exactly 4 players.");
      return;
    }
    setPlayers([...players, '']);
  };
  const removePlayer = (index: number) => {
    // Prevent removing below required minimums
    if (mode === 'casual' && players.length <= 4) return;
    if (mode === 'regular' && players.length <= 4) return;
    if (players.length > 4) {
      const newPlayers = [...players];
      newPlayers.splice(index, 1);
      setPlayers(newPlayers);
    }
  };

  const handleStart = async () => {
    const validPlayers = players.filter(p => p && p.trim());
    
    if (mode === 'casual' && (validPlayers.length < 4 || validPlayers.length > 8)) {
      setError("Americano requires between 4 and 8 players to start.");
      return;
    }
    if (mode === 'regular' && validPlayers.length !== 4) {
      setError("Regular Game requires exactly 4 players to start.");
      return;
    }
    if (validPlayers.length < 4) {
      setError("At least 4 players are required to start.");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      // Payment Gate Logic for Mini Tournament
      let paid = false;
      if (mode === 'tournament') {
        // In a real app, we'd use a custom modal for this instead of alert/confirm
        // Auto-confirming for now to prevent iframe crashes
        paid = true;
      }

      const sessionData = {
        courtId,
        venueId,
        type: mode,
        hostUserId: user?.id || 'guest',
        players: validPlayers.map((name, i) => ({ 
          userId: (i === 0 && user?.id) ? user.id : `guest_${Date.now()}_${i}`, 
          fullName: name 
        })),
        playerIds: validPlayers.map((name, i) => (i === 0 && user?.id) ? user.id : `guest_${Date.now()}_${i}`),
        matches: [],
        status: 'active',
        paid,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      };

      const sessionId = await createQuickplaySessionV2(sessionData);
      if (sessionId) {
        window.location.hash = `quick-play-session?session=${sessionId}`;
      } else {
        throw new Error("Failed to create session. Please try again.");
      }
    } catch (e: any) {
      console.error("Error starting session:", e);
      setError(e.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="w-full p-4 md:p-6 pt-24 md:pt-32 pb-40 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6 relative">
        <div className="flex items-center justify-between mb-8">
          <div className="text-left">
            <h1 className="text-3xl font-[900] italic text-white uppercase tracking-tight mb-1">
              {mode === 'casual' ? 'Americano' : mode === 'tournament' ? 'Mini Tournament' : 'Regular Game'}
            </h1>
            <p className="text-gray-400 font-medium">Add players to start the session.</p>
          </div>
          <button 
            onClick={() => window.location.hash = 'landing'}
            className="text-gray-400 hover:text-white text-sm font-bold transition-colors uppercase tracking-widest"
          >
            Cancel
          </button>
        </div>

        <Card className="p-6 bg-[#111111] border border-white/5">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm font-semibold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest">Players {mode === 'regular' ? '(Exactly 4)' : '(Min 4)'}</label>
            {players.map((player, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={player}
                  onChange={(e) => handlePlayerChange(index, e.target.value)}
                  disabled={isStarting}
                  className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:border-[#4D78FF] disabled:opacity-50 transition-colors"
                  placeholder={`Player ${index + 1}`}
                />
                {players.length > 4 && (
                  <button 
                    onClick={() => removePlayer(index)} 
                    disabled={isStarting}
                    className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl disabled:opacity-50 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            {mode !== 'regular' && (
              <button 
                onClick={addPlayer} 
                disabled={isStarting}
                className="text-[#4D78FF] hover:text-[#3b5bdb] text-sm font-bold flex items-center gap-1 mt-2 disabled:opacity-50 uppercase tracking-wider transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Player
              </button>
            )}
          </div>

          <div className="sticky bottom-0 pt-6 pb-2 pb-safe bg-[#111111] z-10 border-t border-white/5 mt-6 -mx-6 px-6 rounded-b-2xl">
            <button
              onClick={handleStart}
              disabled={isStarting || players.filter(p => p && p.trim()).length < 4}
              className="w-full bg-[#E65C31] hover:bg-[#d45028] disabled:opacity-50 text-white font-[900] italic uppercase tracking-wider py-4 rounded-xl transition-all flex items-center justify-center gap-2 transform active:scale-[0.98] shadow-lg shadow-[#E65C31]/20"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Starting...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" /> Start Session
                </>
              )}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
