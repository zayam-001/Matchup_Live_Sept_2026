import { runTransaction, writeBatch, doc, collection, serverTimestamp, increment, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './storage';

/**
 * The Data Cascade: Records a point (e.g. a Smash) and fans out the update.
 */
export const recordAtomicPoint = async (
  matchId: string,
  tournamentId: string,
  currentSet: number,
  scoringTeam: 'A' | 'B',
  scoringPlayerId: string,
  shotType: string,
  newScoreA: number,
  newScoreB: number,
  refereeId: string
) => {
  if (!db) {
    console.warn('⚠️ Firestore is not configured or is running in mock mode. Skipping recordAtomicPoint.');
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
        // 1. Atomic event (append-only)
        const eventsRef = collection(db, `matches/${matchId}/events`);
        const eventDocRef = doc(eventsRef);
        transaction.set(eventDocRef, {
            type: 'point',
            scoringTeam,
            scoringPlayerId,
            shotType,
            setNum: currentSet,
            scoreAfter: { A: newScoreA, B: newScoreB },
            refereeId,
            timestamp: serverTimestamp(),
        });

        // 3. Player stat increment (only if registered player exists)
        if (scoringPlayerId && scoringPlayerId !== 'unknown' && scoringPlayerId !== 'p1' && scoringPlayerId !== 'p2' && scoringPlayerId !== 'p3' && scoringPlayerId !== 'p4') {
            const playerDocRef = doc(db, `players/${scoringPlayerId}`);
            const playerSnap = await transaction.get(playerDocRef);
            if (playerSnap.exists()) {
                const playerUpdates: any = {
                    'stats.totalPointsWon': increment(1),
                };
                if (shotType === 'smash') playerUpdates['stats.totalSmashes'] = increment(1);
                if (shotType === 'vibora') playerUpdates['stats.totalViboras'] = increment(1);
                
                transaction.update(playerDocRef, playerUpdates);
            }
        }
    });
  } catch (error) {
      console.error("Failed to record atomic point transactionally:", error);
  }
};

/**
 * Reverts the most recent point recorded for a match.
 */
export const undoLastAtomicPoint = async (matchId: string) => {
  if (!db) return;

  try {
    const eventsRef = collection(db, `matches/${matchId}/events`);
    const q = query(eventsRef, orderBy('timestamp', 'desc'), limit(1));
    const snap = await getDocs(q);
    
    if (snap.empty) return;
    
    const lastEventDoc = snap.docs[0];
    const eventData = lastEventDoc.data();
    
    const batch = writeBatch(db);
    batch.delete(lastEventDoc.ref);
    
    const scoringPlayerId = eventData.scoringPlayerId;
    const shotType = eventData.shotType;
    
    if (scoringPlayerId && scoringPlayerId !== 'unknown' && scoringPlayerId !== 'p1' && scoringPlayerId !== 'p2' && scoringPlayerId !== 'p3' && scoringPlayerId !== 'p4') {
      const playerDocRef = doc(db, `players/${scoringPlayerId}`);
      const playerSnap = await getDoc(playerDocRef);
      if (playerSnap.exists()) {
        const playerUpdates: any = {
          'stats.totalPointsWon': increment(-1),
        };
        if (shotType === 'smash') playerUpdates['stats.totalSmashes'] = increment(-1);
        if (shotType === 'vibora') playerUpdates['stats.totalViboras'] = increment(-1);
        
        batch.update(playerDocRef, playerUpdates);
      }
    }
    
    await batch.commit();
  } catch (err) {
    console.error("Failed to undo atomic point:", err);
  }
};
