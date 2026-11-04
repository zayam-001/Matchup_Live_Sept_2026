import { useMemo } from 'react';
import { useGlobalRankings } from './useGlobalRankings';

export interface LeaderboardPlayer {
  id: string;
  name: string;
  gwp: number; // win rate
  wins: number;
  matchesPlayed: number;
  points: number;
}

export const useLeaderboard = () => {
  const { rankings, loading } = useGlobalRankings();
  const leaderboard: LeaderboardPlayer[] = useMemo(() => rankings.map(r => ({
    id: r.key,
    name: r.name,
    wins: r.wins,
    matchesPlayed: r.matchesPlayed,
    points: r.points,
    gwp: r.matchesPlayed > 0 ? (r.wins / r.matchesPlayed) * 100 : 0,
  })), [rankings]);
  return { leaderboard, loadingLeaderboard: loading };
};
