import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, onSnapshot, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../services/storage';

export interface PlayerStats {
  gamesWon: number;
  gamesPlayed: number;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  stats?: PlayerStats;
}

export interface Team {
  id: string;
  name: string;
  players: string[];
  gamesWon: number;
  gamesPlayed: number;
  matchesWon: number;
  matchesPlayed: number;
  playerDetails?: Player[]; 
}

export interface MatchData {
  id: string;
  tournamentId: string;
  teamA: string; 
  teamB: string; 
  scoreA: number | string; 
  scoreB: number | string; 
  status: 'upcoming' | 'live' | 'completed';
  courtNumber: string | number;
  roundName?: string;
  timestamp: any;
  liveState?: any; 
}

export function useLiveScoring() {
  const [liveMatches, setLiveMatches] = useState<MatchData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch all live matches
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'matches'), where('status', '==', 'live'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MatchData));
      setLiveMatches(matches);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching live matches:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadMatchDetails = async (matchId: string) => {
    setLoading(true);
    try {
      const matchDoc = await getDoc(doc(db, 'matches', matchId));
      if (!matchDoc.exists()) throw new Error("Match not found");
      const matchData = { id: matchDoc.id, ...matchDoc.data() } as MatchData;
      setSelectedMatch(matchData);

      // Fetch Teams
      const tADoc = await getDoc(doc(db, 'teams', matchData.teamA));
      const tBDoc = await getDoc(doc(db, 'teams', matchData.teamB));

      const tAData = { id: tADoc.id, ...tADoc.data() } as Team;
      const tBData = { id: tBDoc.id, ...tBDoc.data() } as Team;

      // Fetch Players for Team A
      const pAQ = query(collection(db, 'players'), where('teamId', '==', tAData.id));
      const pASnapshot = await getDocs(pAQ);
      tAData.playerDetails = pASnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));

      // Fetch Players for Team B
      const pBQ = query(collection(db, 'players'), where('teamId', '==', tBData.id));
      const pBSnapshot = await getDocs(pBQ);
      tBData.playerDetails = pBSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));

      setTeamA(tAData);
      setTeamB(tBData);
    } catch (err) {
      console.error('Error loading match details:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncMatchState = async (
    matchId: string, 
    setsA: number, 
    setsB: number, 
    liveStatePayload: any
  ) => {
    try {
      const matchRef = doc(db, 'matches', matchId);
      await updateDoc(matchRef, {
        scoreA: setsA,
        scoreB: setsB,
        liveState: liveStatePayload
      });
    } catch (err) {
      console.error('Error syncing match state:', err);
    }
  };

  const finishMatch = async (matchId: string, winningTeamId: string) => {
    // Transaction enforcing integrity when a match ends
    try {
      await runTransaction(db, async (transaction) => {
        const matchRef = doc(db, 'matches', matchId);
        const matchDoc = await transaction.get(matchRef);
        if (!matchDoc.exists()) throw new Error("Match not found");

        const data = matchDoc.data() as MatchData;
        
        transaction.update(matchRef, { status: 'completed' });

        const tARef = doc(db, 'teams', data.teamA);
        const tBRef = doc(db, 'teams', data.teamB);
        
        const tA = await transaction.get(tARef);
        const tB = await transaction.get(tBRef);

        if (tA.exists()) {
          const tAData = tA.data() as Team;
          transaction.update(tARef, {
            matchesPlayed: (tAData.matchesPlayed || 0) + 1,
            matchesWon: (tAData.matchesWon || 0) + (data.teamA === winningTeamId ? 1 : 0)
          });
        }
        
        if (tB.exists()) {
          const tBData = tB.data() as Team;
          transaction.update(tBRef, {
            matchesPlayed: (tBData.matchesPlayed || 0) + 1,
            matchesWon: (tBData.matchesWon || 0) + (data.teamB === winningTeamId ? 1 : 0)
          });
        }
      });
      setSelectedMatch(null);
    } catch (err) {
      console.error('Error finishing match:', err);
    }
  };

  return {
    liveMatches,
    selectedMatch,
    teamA,
    teamB,
    loading,
    loadMatchDetails,
    syncMatchState,
    finishMatch,
    clearSelectedMatch: () => setSelectedMatch(null)
  };
}
