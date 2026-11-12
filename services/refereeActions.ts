import { writeBatch, doc, collection, serverTimestamp, increment, getDoc, getDocs, query, orderBy, limit, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './storage';

const isRegistered = (id?: string) => !!id && !['unknown', 'p1', 'p2', 'p3', 'p4'].includes(id);

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

  // Plain writes, not a transaction: they apply to the local cache at once and queue
  // while the venue Wi-Fi is down, where a transaction needs the server on every point.
  const eventRef = doc(collection(db, `matches/${matchId}/events`));
  setDoc(eventRef, {
    type: 'point',
    scoringTeam,
    scoringPlayerId,
    shotType,
    setNum: currentSet,
    scoreAfter: { A: newScoreA, B: newScoreB },
    refereeId,
    at: Date.now(), // client time: orders points that haven't reached the server yet
    timestamp: serverTimestamp(),
  }).catch(error => console.error("Failed to record point event:", error));

  // Player stat increment (only for registered players; a missing profile just isn't counted).
  if (isRegistered(scoringPlayerId)) {
    const playerUpdates: any = { 'stats.totalPointsWon': increment(1) };
    if (shotType === 'smash') playerUpdates['stats.totalSmashes'] = increment(1);
    if (shotType === 'vibora') playerUpdates['stats.totalViboras'] = increment(1);
    updateDoc(doc(db, `players/${scoringPlayerId}`), playerUpdates).catch(() => { /* no profile */ });
  }
};

/**
 * Reverts the most recent point recorded for a match.
 */
export const undoLastAtomicPoint = async (matchId: string) => {
  if (!db) return;

  try {
    const eventsRef = collection(db, `matches/${matchId}/events`);
    // Newest point first: by client time (also covers points still waiting to sync), else server time for older events.
    let snap = await getDocs(query(eventsRef, orderBy('at', 'desc'), limit(1)));
    if (snap.empty) snap = await getDocs(query(eventsRef, orderBy('timestamp', 'desc'), limit(1)));
    
    if (snap.empty) return;
    
    const lastEventDoc = snap.docs[0];
    const eventData = lastEventDoc.data();
    
    const batch = writeBatch(db);
    batch.delete(lastEventDoc.ref);
    
    const scoringPlayerId = eventData.scoringPlayerId;
    const shotType = eventData.shotType;
    
    if (isRegistered(scoringPlayerId)) {
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
