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
        
        const rawEntries = snap.docs.map(doc => {
            const d = doc.data();
            const matchesPlayed = d.matchesPlayed || 0;
            const wins = d.wins || 0;
            return {
                id: doc.id,
                name: (d.playerName || 'Unknown').trim(),
                matchesPlayed,
                wins,
                points: d.points || 0,
                gwp: matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0,
                lastUpdatedMs: d.lastUpdated?.toMillis ? d.lastUpdated.toMillis() : 0,
            };
        });

        // FIX (client feedback: landing page stats need to be real, with no
        // duplicate entries): the same player accumulates a fresh
        // 'leaderboard' doc every time their global stats are recomputed
        // instead of one doc being kept in sync, so most real players have
        // 2-3+ near-identical entries under slightly different ids - e.g.
        // one player alone had 1,308 leaderboard docs across only 428 unique
        // names. Until that write path is fixed, dedupe here on read: keep
        // one row per unique player name (case-insensitive), preferring the
        // entry with the most matches played, then the most recently
        // updated one.
        const byName = new Map<string, typeof rawEntries[number]>();
        for (const entry of rawEntries) {
            const key = entry.name.toLowerCase();
            const existing = byName.get(key);
            if (!existing) {
                byName.set(key, entry);
                continue;
            }
            const entryIsBetter = entry.matchesPlayed !== existing.matchesPlayed
                ? entry.matchesPlayed > existing.matchesPlayed
                : entry.lastUpdatedMs > existing.lastUpdatedMs;
            if (entryIsBetter) byName.set(key, entry);
        }
        const arr: LeaderboardPlayer[] = Array.from(byName.values()).map(({ lastUpdatedMs, ...rest }) => rest);

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
