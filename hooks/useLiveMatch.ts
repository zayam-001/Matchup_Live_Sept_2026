import { useState, useEffect } from 'react';
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';

import { db } from '../services/storage';

/**
 * Single listener for Live Match. No nested reads!
 */
export const useLiveMatch = (tournamentId: string, matchId: string) => {
  const [matchData, setMatchData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!matchId || !tournamentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const matchRef = doc(db, `matches/${matchId}`);
    
    // ONE listener, instant updates
    const unsub = onSnapshot(matchRef, 
      (snap) => {
        if (snap.exists()) {
           setMatchData({ id: snap.id, ...snap.data() });
        } else {
           setMatchData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching live match:', err);
        setError(err);
        setLoading(false);
      }
    );

    // Unsubscribe on unmount! (Checklist #1)
    return () => unsub();
  }, [matchId]);

  return { matchData, loading, error };
};
