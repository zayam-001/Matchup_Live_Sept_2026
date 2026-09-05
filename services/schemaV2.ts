import { Timestamp } from 'firebase/firestore';

export interface FSTournament {
  id: string; // Document ID
  name: string;
  sport: string;
  format: string; // 'round_robin' | 'group_knockout' | 'knockout'
  status: 'draft' | 'active' | 'completed';
  organizerId: string;
  organizerName: string;
  categories: string[];
  venueIds: string[];
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  prizePool: number;
  matchCount: number;
  completedMatchCount: number;
}

export interface FSMatchStub {
  id: string;
  tournamentId: string;
  status: string; // "scheduled" | "live" | "completed" | "walkover"
  teamA: { id: string, name: string, score: number };
  teamB: { id: string, name: string, score: number };
  scheduledAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface FSMatch {
  id: string;
  tournamentId: string;
  refereeId: string;
  refereeName: string;
  teamA: { teamId: string, name: string, playerIds: string[], score: number };
  teamB: { teamId: string, name: string, playerIds: string[], score: number };
  status: string; // "scheduled" | "live" | "completed" | "walkover"
  winnerId: string | null;
  sets: { setNum: number, scoreA: number, scoreB: number, completedAt?: Timestamp | null }[];
  currentSet: number;
  courtId: string;
  scheduledAt: Timestamp | null;
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
  bracketPosition: string | null;
  updatedAt: Timestamp | null;
}

export interface FSMatchEvent {
  id: string;
  timestamp: Timestamp;
  type: 'point' | 'fault' | 'let' | 'timeout' | 'match_end';
  scoringTeam: 'A' | 'B' | null;
  scoringPlayerId: string | null;
  shotType: 'smash' | 'vibora' | 'bandeja' | 'lob' | 'volley' | 'winner' | 'error' | null;
  setNum: number;
  scoreAfter: { A: number, B: number };
  refereeId: string;
}

export interface FSPlayer {
  id: string;
  name?: string;
  stats: {
    totalSmashes: number;
    totalPointsWon: number;
    matchesPlayed: number;
    matchesWon: number;
    gamesWon: number;
    gamesPlayed: number;
    gwp: number;
  };
  sport: string;
}
