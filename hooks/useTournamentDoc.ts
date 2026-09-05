import { useState, useEffect } from 'react';
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';

import { db } from '../services/storage';

export const useTournamentDoc = (tournamentId: string | null) => {
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) {
      setTournament(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(doc(db, `tournaments/${tournamentId}`), (snap) => {
      if (snap.exists()) {
        setTournament({ id: snap.id, ...snap.data() });
      } else {
        setTournament(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [tournamentId]);

  return { tournament, loading };
};
export default useTournamentDoc;
