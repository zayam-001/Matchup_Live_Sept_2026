import { runTransaction, doc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { db } from './storage';

/**
 * Increment referee and tournament metrics when a match completes.
 */
export const completeMatchAndAdvance = async (
  matchId: string, 
  tournamentId: string, 
  winnerId: string, 
  refereeId: string,
  standingDocId?: string,
  scoreState?: any
) => {
  if (!db) {
    console.warn('⚠️ Firestore is not configured or is running in mock mode. Skipping atomic match completion metrics.');
    return;
  }

  try {
    await runTransaction(db, async (txn) => {
      const tournamentRef = doc(db, `tournaments/${tournamentId}`);
      
      // Update referee completed count atomically (only if not default mock ID)
      if (refereeId && refereeId !== 'currentReferee' && refereeId !== 'undefined') {
        txn.set(doc(db, `referees/${refereeId}`), {
          completedMatchCount: increment(1),
          lastMatchAt: serverTimestamp(),
        }, { merge: true });
      }

      // Update tournament global metrics
      txn.set(tournamentRef, {
        completedMatchCount: increment(1)
      }, { merge: true });
    });
  } catch (error) {
    console.error('Error during completeMatchAndAdvance transaction:', error);
    throw error;
  }
};
