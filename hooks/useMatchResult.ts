import { useState, useEffect } from 'react';
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';
import { Match } from '../types';

import { db } from '../services/storage';

export const useMatchResult = (matchId: string | null) => {
  const [matchData, setMatchData] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!matchId) {
      setMatchData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Since matches are stored globally in "matches" collection
    const matchRef = doc(db, `matches/${matchId}`);
    
    const unsub = onSnapshot(matchRef, 
      (snap) => {
        if (snap.exists()) {
           setMatchData({ id: snap.id, ...snap.data() } as Match);
        } else {
           setMatchData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching match result:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [matchId]);

  return { matchData, loading, error, setMatchData }; // Exposing setMatchData for optimistic UI updates if needed
};
