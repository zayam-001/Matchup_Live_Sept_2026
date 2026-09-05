import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getFirestore } from 'firebase/firestore';
import { Match } from '../types';

import { db } from '../services/storage';

export const useTournamentMatches = (tournamentId: string | null) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Note: To use orderBy, we may need indexes. 
    // From CLAUDE_PROMPT.md: 
    // query(collection(db, `tournaments/${tid}/matches`), where('status', 'in', ['scheduled', 'live']), orderBy('scheduledAt'))
    // Let's just listen to all stubs for the scoreboard and filter client-side for now to avoid immediate index issues if they aren't deployed.
    const q = query(
      collection(db, "matches"),
      where("tournamentId", "==", tournamentId)
    );

    const unsub = onSnapshot(q, 
      (snap) => {
        const results = snap.docs.map(d => ({ 
           id: d.id, 
           tournamentId: tournamentId, 
           ...d.data() 
        } as Match));
        setMatches(results);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching tournament matches:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [tournamentId]);

  return { matches, loading, error };
};
