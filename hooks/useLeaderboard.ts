import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/storage';

export interface LeaderboardPlayer {
  id: string;
  name: string;
  gwp: number; // win rate
  wins: number;
  matchesPlayed: number;
  points: number;
}

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!db) {
      setLoadingLeaderboard(false);
      return;
    }

    const fetchLeaderboard = async () => {
      try {
        const lbRef = collection(db, 'leaderboard');
        // Fetch players and sort them client-side in case there's no index for points
        const q = query(lbRef, limit(100)); // We can add orderBy('points', 'desc') if we have the index, but we'll sort locally to be safe.
        const snap = await getDocs(q);
        
        const arr: LeaderboardPlayer[] = snap.docs.map(doc => {
            const d = doc.data();
            const matchesPlayed = d.matchesPlayed || 0;
            const wins = d.wins || 0;
            return {
                id: doc.id,
                name: d.playerName || 'Unknown',
                matchesPlayed,
                wins,
                points: d.points || 0,
                gwp: matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0
            };
        });

        // Sort by total points descending, then wins, then win rate
        arr.sort((a, b) => {
           if (b.points !== a.points) return b.points - a.points;
           if (b.wins !== a.wins) return b.wins - a.wins;
           return b.gwp - a.gwp;
        });

        if (mounted) {
          setLeaderboard(arr);
          setLoadingLeaderboard(false);
        }
      } catch (e) {
        console.error("Error fetching leaderboard:", e);
        if (mounted) setLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();

    return () => { mounted = false; };
  }, []);

  return { leaderboard, loadingLeaderboard };
};
