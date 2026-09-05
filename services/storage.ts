import { firebaseConfig } from "../lib/firebase";
import { initializeApp } from "firebase/app";

import { getAuth, signInWithPopup, GoogleAuthProvider, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { 
    getFirestore, 
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    memoryLocalCache,
    collection, 
    doc, 
    addDoc, 
    setDoc,
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    getDoc, 
    getDocs,
    writeBatch,
    query, 
    where,
    orderBy,
    deleteField,
    increment,
    arrayUnion,
    limit,
    runTransaction,
    serverTimestamp,
    FieldValue,
    Timestamp
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
    Tournament, 
    Team, 
    Match, 
    MatchStatus, 
    ScoreState, TournamentFormat, 
    RoundRobinType, 
    MatchDependency,
    Sponsor,
    MatchRating,
    PlayerProfile,
    SkillLevel,
    QuickSession,
    QuickMatch,
    Venue,
    Organizer,
    AutoScheduleConfig,
    SchedulingSlot,
    Player,
    OnboardedPlayer,
    OnboardedTeam
} from '../types';

// ==================================================================
// ⚙️ CONFIGURATION
// ==================================================================



export let db: any = null;
export let auth: any = null;
export let storage: any = null;
let isMock = false;

try {
    const app = initializeApp(firebaseConfig);
    
    
    // Enable offline persistence and fix connection issues in sandboxed environments
    try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          experimentalForceLongPolling: true
        }, (firebaseConfig as any).firestoreDatabaseId);
    } catch (e: any) {
        if (e.message && e.message.includes('already been called')) {
            db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
        } else {
            console.warn("⚠️ Failed to initialize persistent local cache. Falling back to memory local cache.", e);
            try {
                db = initializeFirestore(app, {
                    localCache: memoryLocalCache(),
                    experimentalForceLongPolling: true
                }, (firebaseConfig as any).firestoreDatabaseId);
            } catch (err: any) {
                if (err.message && err.message.includes('already been called')) {
                    db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
                } else {
                    throw err;
                }
            }
        }
    }
    
    auth = getAuth(app);
    storage = getStorage(app);
    console.log("🔥 Connected to Firebase Firestore and Storage");
} catch (e) {
    console.error("Firebase Init Error:", e);
    console.warn("⚠️ Falling back to Mock Storage due to error");
    isMock = true;
}

export const advanceBracket = (allMatches: Match[], completedMatch: Match, winnerId: string, winnerName?: string): Match[] => {
    return allMatches.map(m => {
        // If this match is the direct next match for the completed one
        const isNextMatch = completedMatch.nextMatchId && m.id === completedMatch.nextMatchId;
        const isTeam1Dep = m.team1Dependency?.sourceId === completedMatch.id;
        const isTeam2Dep = m.team2Dependency?.sourceId === completedMatch.id;

        if (isTeam1Dep || (isNextMatch && (!m.team1Id || m.team1Id.includes('TBD') || m.team1Id.includes('winner')))) {
             return { 
                 ...m, 
                 team1Id: winnerId,
                 team1Name: winnerName || m.team1Name || 'Winner'
             };
        }
        if (isTeam2Dep || (isNextMatch && (!m.team2Id || m.team2Id.includes('TBD') || m.team2Id.includes('winner')))) {
             return { 
                 ...m, 
                 team2Id: winnerId,
                 team2Name: winnerName || m.team2Name || 'Winner'
             };
        }
        return m;
    });
};



// ==================================================================
// PLAYER HISTORY SYNC
// ==================================================================
export const syncPlayerMatchToHistory = async (match: Match, tournament?: Tournament) => {
    if (!db || !match.winnerTeamId || (match.status !== MatchStatus.COMPLETED && match.status !== 'FINISHED' as any)) {
        return;
    }

    try {
        let tData = tournament;
        if (!tData && match.tournamentId) {
            const tRef = doc(db, 'tournaments', match.tournamentId);
            const tSnap = await getDoc(tRef);
            if (tSnap.exists()) {
                tData = tSnap.data() as Tournament;
            }
        }
        
        if (!tData || !tData.teams) return;

        const team1 = tData.teams.find(t => t.id === match.team1Id);
        const team2 = tData.teams.find(t => t.id === match.team2Id);
        
        if (!team1 && !team2) return;

        // Fetch configs for Tier and Skill Shots
        let perWinBonus = 15; // default for Club League
        let skillConfigs: Record<string, number> = {
            "smash": 5, "drop_shot": 5, "vibora": 5, "bandeja": 5, "chiquita": 5, "lob": 5, "bajada": 5, "rulo": 5, "kill_shot": 5, "block": 5, "drop shot": 5, "kill shot": 5
        };

        try {
            const tierDoc = await getDoc(doc(db, 'configs', 'tiers'));
            if (tierDoc.exists()) {
                const tiers = tierDoc.data();
                // Assume tournament tier is somehow matched, else default to CLUB_LEAGUE
                // We'll use a loose check, or just default to Club League
                if (tiers["CLUB_LEAGUE"]?.perWinBonus !== undefined) {
                    perWinBonus = tiers["CLUB_LEAGUE"].perWinBonus;
                }
            }
            const skillDoc = await getDoc(doc(db, 'configs', 'skill_shots'));
            if (skillDoc.exists()) {
                skillConfigs = { ...skillConfigs, ...skillDoc.data() };
            }
        } catch (err) {
            console.warn("Could not load configs, using defaults.");
        }

        // Fetch Match Events for skill points
        let playerSkillPoints: Record<string, number> = {};
        try {
            const eventsRef = collection(db, `matches/${match.id}/events`);
            const eventsSnap = await getDocs(eventsRef);
            eventsSnap.docs.forEach(d => {
                const e = d.data();
                if (e.type === 'point' && e.scoringPlayerId && e.shotType && e.shotType !== 'generic') {
                    const points = skillConfigs[e.shotType.toLowerCase()] || 0;
                    if (points > 0) {
                        playerSkillPoints[e.scoringPlayerId] = (playerSkillPoints[e.scoringPlayerId] || 0) + points;
                    }
                }
            });
        } catch (err) {
            console.warn("Could not load match events.");
        }

        const batch = writeBatch(db);
        const historyCol = collection(db, 'player_match_history');
        const tourLeaderboardCol = collection(db, 'tournaments', match.tournamentId, 'leaderboard');
        
        const processTeam = (team: Team | undefined, opponent: Team | undefined) => {
            if (!team) return;
            const isWinner = match.winnerTeamId === team.id;
            const matchWinBonus = isWinner ? perWinBonus : 0;

            const players = [team.player1, team.player2].filter(Boolean);
            players.forEach(p => {
                if (!p.id) return;
                
                const skillPoints = playerSkillPoints[p.id] || 0;
                const totalMatchPoints = matchWinBonus + skillPoints;

                // 1. Write Match History
                const docRef = doc(historyCol, `${p.id}_${match.id}`);
                batch.set(docRef, {
                    playerId: p.id,
                    matchId: match.id,
                    tournamentId: match.tournamentId,
                    tournamentName: tData?.name || '',
                    teamId: team.id,
                    opponentTeamId: opponent ? opponent.id : null,
                    won: isWinner,
                    score: match.score || null,
                    date: match.startedAt || match.scheduledTime || match.scheduledStartTime || new Date().toISOString(),
                    matchWinBonus,
                    skillPoints,
                    totalMatchPoints,
                    timestamp: serverTimestamp()
                }, { merge: true });

                // 2. Increment TOURNAMENT Leaderboard Stats (Live running total)
                const tourLbRef = doc(tourLeaderboardCol, p.id);
                batch.set(tourLbRef, {
                    playerId: p.id,
                    playerName: p.name || '',
                    playerPhone: p.phone || '',
                    playerAvatar: p.photoUrl || '',
                    gender: 'M', // Defaulting for now
                    matchesPlayed: increment(1),
                    matchWins: increment(isWinner ? 1 : 0),
                    matchLosses: increment(isWinner ? 0 : 1),
                    skillPoints: increment(skillPoints),
                    matchWinPoints: increment(matchWinBonus),
                    totalPoints: increment(totalMatchPoints),
                    lastUpdated: serverTimestamp()
                }, { merge: true });
            });
        };

        processTeam(team1, team2);
        processTeam(team2, team1);

        await batch.commit();
        console.log("Successfully synced match to player history and tournament leaderboard!");
    } catch (e) {
        console.error("Failed to sync player match to history:", e);
    }
};

export const finalizePlayerTournamentGlobalPoints = async (tournamentId: string, playerId: string, placement: string, isChampion: boolean = false) => {
    if (!db) return;
    try {
        const tourLbRef = doc(db, 'tournaments', tournamentId, 'leaderboard', playerId);
        const tourLbSnap = await getDoc(tourLbRef);
        if (!tourLbSnap.exists()) return;
        
        const tourStats = tourLbSnap.data();
        if (tourStats.globalFolded) return; // Already folded into global
        
        // Load placement configs
        let placementBonus = 15; // default participation
        try {
            const tierDoc = await getDoc(doc(db, 'configs', 'tiers'));
            if (tierDoc.exists()) {
                const tiers = tierDoc.data();
                const placementConfig = tiers["CLUB_LEAGUE"]?.placement || {};
                placementBonus = placementConfig[placement] || placementConfig["PARTICIPATION"] || 15;
            }
        } catch(e) {}

        const globalLbRef = doc(db, 'leaderboard', playerId);
        const batch = writeBatch(db);
        
        // Mark as folded
        batch.update(tourLbRef, {
            globalFolded: true,
            placement,
            placementBonus
        });

        // Fold into global
        batch.set(globalLbRef, {
            playerId,
            playerName: tourStats.playerName,
            playerPhone: tourStats.playerPhone,
            matchesPlayed: increment(tourStats.matchesPlayed || 0),
            wins: increment(tourStats.matchWins || 0),
            losses: increment(tourStats.matchLosses || 0),
            skillPoints: increment(tourStats.skillPoints || 0),
            matchWinPoints: increment(tourStats.matchWinPoints || 0),
            placementPoints: increment(placementBonus),
            points: increment((tourStats.totalPoints || 0) + placementBonus),
            lastUpdated: serverTimestamp()
        }, { merge: true });

        await batch.commit();
        console.log(`Folded tournament stats for ${playerId} into global leaderboard.`);
    } catch (e) {
        console.error("Failed to fold player tournament points to global", e);
    }
};

export const isConfigured = !isMock;

// ------------------------------------------------------------------
// ERROR HANDLING
// ------------------------------------------------------------------

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo?: any[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ------------------------------------------------------------------
// UTILS
// ------------------------------------------------------------------
const cleanData = (data: any) => {
    const seen = new WeakMap();

    const clone = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') {
            return obj === undefined ? null : obj;
        }
        if (obj instanceof Date) return obj.toISOString();
        if (obj instanceof RegExp) return obj.toString();
        if (obj instanceof FieldValue || obj instanceof Timestamp) return obj;

        // Safety blocks
        if (obj.nodeType || obj.$$typeof || (obj.constructor && obj.constructor.name && (obj.constructor.name.startsWith('_') || obj.constructor.name === 'SyntheticBaseEvent'))) {
            return null; 
        }

        if (seen.has(obj)) return null;
        seen.set(obj, true);

        if (Array.isArray(obj)) return obj.map(item => clone(item));

        const output: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = clone(obj[key]);
                if (val !== undefined) output[key] = val;
            }
        }
        return output;
    };

    return clone(data);
};

const deepClone = <T>(obj: T): T => {
    return cleanData(obj) as T;
};

// ------------------------------------------------------------------
// MOCK STORAGE STATE
// ------------------------------------------------------------------
let mockTournaments: Tournament[] = [];
const listeners: ((data: Tournament[]) => void)[] = [];
const tournamentListeners: {id: string, cb: (data: Tournament | null) => void}[] = [];

const notifyMock = () => {
    const safeData = cleanData(mockTournaments);
    listeners.forEach(l => l(safeData));
    tournamentListeners.forEach(tl => {
        const t = safeData.find((tour: Tournament) => tour.id === tl.id);
        tl.cb(t ? t : null);
    });
};

const genId = () => Math.random().toString(36).substr(2, 9);
const initialScore: ScoreState = {
  p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0, p1Sets: 0, p2Sets: 0,
  p1SetScores: [], p2SetScores: [], currentSet: 1, isTiebreak: false, history: [], timeline: []
};

const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w-]+/g, '')  // Remove all non-word chars
      .replace(/--+/g, '-');    // Replace multiple - with single -
};

const createMatchObject = (tId: string, name: string, round: number, stage: 'GROUP'|'BRACKET'|'PLAYOFF', timeOffset: number, court: string, t1?: string, t2?: string): Match => {
    const sTime = new Date(new Date().getTime() + (timeOffset * 60 * 60 * 1000)).toISOString();
    return {
        id: genId(), tournamentId: tId, team1Id: t1 || '', team2Id: t2 || '',
        stage, round, roundName: name, 
        court: court || null, courtId: court || null, courtName: court || null,
        scheduledCourtId: court || null,
        scheduledStartTime: sTime,
        actualCourtId: null,
        courtOverrideBy: null,
        courtOverrideAt: null,
        conflictAcknowledged: null,
        obsEnabled: false, obsUrl: null,
        scheduledTime: sTime,
        status: MatchStatus.SCHEDULED, score: deepClone(initialScore)
    };
};

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

// Helper to save sponsors to sub-collection
const saveSponsorsToSubCollection = async (tId: string, sponsors: Sponsor[]) => {
    const batch = writeBatch(db);
    const sponsorsCollection = collection(db, "tournaments", tId, "sponsors");
    
    // Get existing to find deletions
    const existingSnaps = await getDocs(sponsorsCollection);
    const existingIds = existingSnaps.docs.map(d => d.id);
    const newIds = sponsors.map(s => s.id);

    // Delete removed sponsors
    existingSnaps.docs.forEach(d => {
        if (!newIds.includes(d.id)) {
            batch.delete(d.ref);
        }
    });

    // Set/Update new sponsors
    sponsors.forEach(s => {
        // Ensure ID
        const id = s.id || genId();
        const ref = doc(sponsorsCollection, id);
        batch.set(ref, { ...s, id }, { merge: true });
    });

    await batch.commit();
};

// ------------------------------------------------------------------
// AUTH & PLAYER IDENTITY (MOCK)
// ------------------------------------------------------------------

export const registerPlayer = async (data: any) => {
    if (!auth) throw new Error("Firebase not initialized");
    
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;

    let pointsEarned = 0;
    let referredBy = null;
    
    if (data.promoCode && db) {
      const promoRef = doc(db, 'promoCodes', data.promoCode);
      const promoSnap = await getDoc(promoRef);
      if (promoSnap.exists()) {
        const promoData = promoSnap.data();
        const uniqueSignUps = promoData.uniqueSignUps || [];
        if (!uniqueSignUps.includes(user.uid)) {
          referredBy = data.promoCode;
          await updateDoc(promoRef, {
            uniqueSignUps: arrayUnion(user.uid),
            pointsEarned: increment(100)
          });
        }
      }
    }

    const newPlayer = {
        id: user.uid,
        fullName: data.name,
        email: data.email,
        phone: data.phone,
        cnic: data.cnic || '',
        gender: data.gender || 'male',
        role: 'player',
        stats: {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            setsWon: 0,
            eloRating: 1000
        },
        firstMiniTournamentUsed: false,
        promoCode: null,
        promoPoints: 0,
        referredBy,
        createdAt: new Date().toISOString()
    };
    
    if (db) {
        try {
            // 2. Store the user's data in the 'players' collection
            const playerRef = doc(db, 'players', newPlayer.id);
            await setDoc(playerRef, newPlayer, { merge: true });
            await syncSingleStandalonePlayerToGlobal(newPlayer);

            // Increment global players
            const globalRef = doc(db, 'globalStats', 'singleton');
            await setDoc(globalRef, { totalPlayers: increment(1) }, { merge: true });

            // 3. Trigger the welcome email by adding a document to the 'mail' collection
            const mailCollection = collection(db, 'mail');
            await addDoc(mailCollection, {
                to: newPlayer.email,
                message: {
                    subject: "Welcome to Match Up!",
                    from: "Match Up <info@matchup.com.pk>",
                    replyTo: "info@matchup.com.pk",
                    headers: {
                        'X-Priority': '1 (Highest)',
                        'Importance': 'high'
                    },
                    html: `
                        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #ffffff;">
                            
                            <!-- Header Logo -->
                            <div style="text-align: center; margin-bottom: 40px;">
                                <h2 style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 900; letter-spacing: -1px;">Match-up</h2>
                            </div>

                            <!-- Greeting -->
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="font-size: 36px; color: #333; margin: 0; font-weight: 800; line-height: 1.2;">
                                    Hey ${newPlayer.fullName},<br/>
                                    welcome on board!
                                </h1>
                            </div>

                            <!-- Hero Image -->
                            <div style="margin-bottom: 40px; text-align: center;">
                                <img src="https://firebasestorage.googleapis.com/v0/b/tournament-scoring-app-7dff5.firebasestorage.app/o/Gemini_Generated_Image_dfxqwxdfxqwxdfxq.png?alt=media&token=6fa34fbf-ba1e-4c45-948c-e5d18174daaa" alt="Welcome Onboard" style="width: 100%; max-width: 600px; border-radius: 12px;" />
                            </div>

                            <!-- Body Text -->
                            <div style="font-size: 18px; line-height: 1.6; color: #444; padding: 0 20px; text-align: left;">
                                <p style="margin-top: 0; margin-bottom: 20px;">Welcome to the Match Up platform. We are excited to have you! Your global sports identity is now active. You can start registering for tournaments, managing your squads, and tracking your stats.</p>
                                <p style="margin-bottom: 0;">We're here to make your experience amazing. If you have any questions or feedback, feel free to reply to this email, we'd love to hear from you!</p>
                                <div style="margin-top: 30px; text-align: center;"><a href="https://matchup.com.pk" style="background-color: #4D78FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Match Up</a></div>
                            </div>

                            <!-- Divider -->
                            <hr style="border: none; border-top: 1px solid #eee; margin: 60px 20px 40px;" />

                            <!-- Footer -->
                            <div style="text-align: left; font-size: 14px; color: #666; line-height: 1.6; padding: 0 20px;">
                                <h3 style="margin: 0 0 10px; color: #333; font-size: 18px; font-weight: 600;">Match Up</h3>
                                <p style="margin: 0 0 20px;">National Incubation Center, NED University, Karachi</p>
                                
                                <p style="margin: 0 0 5px;">This email was sent to <a href="mailto:${newPlayer.email}" style="color: #4f46e5; text-decoration: none;">${newPlayer.email}</a>.</p>
                                <p style="margin: 0 0 20px;">You've received this email because you've subscribed to our newsletter.</p>
                                
                                <a href="#" style="color: #666; text-decoration: underline;">Unsubscribe</a>
                            </div>
                        </div>
                    `
                }
            });
        } catch (error) {
            console.error("Error saving player to Firestore or sending email:", error);
        }
    }
    
    return newPlayer;
};

export const setPlayerPersistence = async (rememberMe: boolean) => {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
};

export const loginPlayer = async (email: string, password?: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    if (!password) throw new Error("Password is required");
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (db) {
        try {
            const userRef = doc(db, 'players', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                return userSnap.data();
            }
        } catch (error) {
            console.error("Error fetching player from Firestore:", error);
        }
    }

    return user;
};


export const loginOrganiser = async (email: string, password?: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    if (!password) throw new Error("Password is required");
    
    // First, try signing in with Firebase
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (db) {
            const orgRef = doc(db, 'adminUsers', user.uid);
            let orgSnap = await getDoc(orgRef);
            
            if (orgSnap.exists()) {
                return { user, organiserData: orgSnap.data() };
            } else {
                // Fallback: check users collection
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    if (userData.role === 'admin' || userData.role === 'organiser' || userData.role === 'referee') {
                        return { user, organiserData: userData };
                    }
                }
                
                // Fallback 2: Check by email in adminUsers just in case Control Tower uses email as ID
                const emailQuery = query(collection(db, 'adminUsers'), where('email', '==', user.email || email));
                const emailQuerySnap = await getDocs(emailQuery);
                if (!emailQuerySnap.empty) {
                    return { user, organiserData: emailQuerySnap.docs[0].data() };
                }

                // Fallback 3: Check by email in users collection
                const userEmailQuery = query(collection(db, 'users'), where('email', '==', user.email || email));
                const userEmailQuerySnap = await getDocs(userEmailQuery);
                if (!userEmailQuerySnap.empty) {
                    const userData = userEmailQuerySnap.docs[0].data();
                    if (userData.role === 'admin' || userData.role === 'organiser' || userData.role === 'referee') {
                        return { user, organiserData: userData };
                    }
                }

                throw new Error("No admin/staff record found for this account.");
            }
        }
        return { user, organiserData: null };
    } catch (e: any) {
        // Fallback or specific handling could go here. Let it throw to Auth.tsx.
        throw e;
    }
};

export const changeOrganiserPassword = async (newPassword: string) => {
    if (!auth || !auth.currentUser) throw new Error("No authenticated user");
    
    // Update password in Firebase Auth
    await updatePassword(auth.currentUser, newPassword);

    // Update Firestore to remove the mustChangePassword flag
    if (db) {
        const orgRef = doc(db, 'adminUsers', auth.currentUser.uid);
        await updateDoc(orgRef, { mustChangePassword: false });
    }
};

export const skipOrganiserPasswordChange = async () => {
    if (!auth || !auth.currentUser) throw new Error("No authenticated user");
    
    if (db) {
        const orgRef = doc(db, 'adminUsers', auth.currentUser.uid);
        await updateDoc(orgRef, { mustChangePassword: false });
    }
};

export const loginWithGoogle = async () => {
    if (!auth) throw new Error("Firebase not initialized");
    
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user exists in our 'players' collection
    if (db) {
        const userRef = doc(db, 'players', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            return { user, isNewUser: true };
        }
    }
    
    return { user, isNewUser: false };
};

export const completeGoogleSignUp = async (user: any, data: any) => {
    if (!auth || !db) throw new Error("Firebase not initialized");

    if (data.password) {
        try {
            await updatePassword(user, data.password);
        } catch (e) {
            console.error("Failed to update password for Google user:", e);
            // We can continue even if password update fails
        }
    }

    let pointsEarned = 0;
    
    if (data.promoCode) {
      const promoRef = doc(db, 'promoCodes', data.promoCode);
      const promoSnap = await getDoc(promoRef);
      if (promoSnap.exists()) {
        const promoData = promoSnap.data();
        pointsEarned = promoData.pointsEarned || 100;
        
        await updateDoc(promoRef, {
          totalUses: increment(1),
          uniqueSignUps: arrayUnion(user.uid),
          pointsEarned: increment(100)
        });
      }
    }

    const userData = {
        id: user.uid,
        fullName: data.name || user.displayName || 'Google User',
        email: user.email,
        phone: data.phone || user.phoneNumber || '',
        cnic: data.cnic || '',
        gender: data.gender || 'male',
        role: 'player',
        stats: {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            setsWon: 0,
            eloRating: parseInt(data.skillLevel) || 1000
        },
        firstMiniTournamentUsed: false,
        promoCode: data.promoCode || null,
        promoPoints: pointsEarned,
        createdAt: new Date().toISOString()
    };
    
    const userRef = doc(db, 'players', user.uid);
    await setDoc(userRef, userData);
    
    // Increment global players
    const globalRef = doc(db, 'globalStats', 'singleton');
    await setDoc(globalRef, { totalPlayers: increment(1) }, { merge: true });

    // Trigger the welcome email by adding a document to the 'mail' collection
    if (user.email) {
        const mailCollection = collection(db, 'mail');
        await addDoc(mailCollection, {
            to: user.email,
            message: {
                subject: "Welcome to Match Up!",
                from: "Match Up <info@matchup.com.pk>",
                replyTo: "info@matchup.com.pk",
                headers: {
                    'X-Priority': '1 (Highest)',
                    'Importance': 'high'
                },
                html: `
                    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #ffffff;">
                        <!-- Header Logo -->
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #4f46e5; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Match Up</h1>
                        </div>
                        <!-- Hero Image -->
                        <div style="margin-bottom: 40px; text-align: center;">
                            <img src="https://firebasestorage.googleapis.com/v0/b/tournament-scoring-app-7dff5.firebasestorage.app/o/Gemini_Generated_Image_dfxqwxdfxqwxdfxq.png?alt=media&token=6fa34fbf-ba1e-4c45-948c-e5d18174daaa" alt="Welcome Onboard" style="width: 100%; max-width: 600px; border-radius: 12px;" />
                        </div>
                        <!-- Body Text -->
                        <div style="font-size: 18px; line-height: 1.6; color: #444; padding: 0 20px; text-align: left;">
                            <p style="margin-top: 0; margin-bottom: 20px;">Welcome to the Match Up platform. We are excited to have you! Your global sports identity is now active. You can start registering for tournaments, managing your squads, and tracking your stats.</p>
                            <p style="margin-bottom: 0;">We're here to make your experience amazing. If you have any questions or feedback, feel free to reply to this email, we'd love to hear from you!</p>
                            <div style="margin-top: 30px; text-align: center;"><a href="https://matchup.com.pk" style="background-color: #4D78FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Match Up</a></div>
                        </div>
                        <!-- Divider -->
                        <hr style="border: none; border-top: 1px solid #eee; margin: 60px 20px 40px;" />
                        <!-- Footer -->
                        <div style="text-align: left; font-size: 14px; color: #666; line-height: 1.6; padding: 0 20px;">
                            <h3 style="margin: 0 0 10px; color: #333; font-size: 18px; font-weight: 600;">Match Up</h3>
                            <p style="margin: 0 0 20px;">National Incubation Center, NED University, Karachi</p>
                            <p style="margin: 0 0 5px;">This email was sent to <a href="mailto:${user.email}" style="color: #4f46e5; text-decoration: none;">${user.email}</a>.</p>
                            <p style="margin: 0 0 20px;">You've received this email because you've subscribed to our newsletter.</p>
                            <a href="#" style="color: #666; text-decoration: underline;">Unsubscribe</a>
                        </div>
                    </div>
                `
            }
        });
    }
    
    return userData;
};

export const logoutPlayer = () => {
    localStorage.removeItem('player_session');
};

export const getCurrentPlayer = () => {
    const session = localStorage.getItem('player_session');
    if (!session) return null;
    
    try {
        const { id, timestamp } = JSON.parse(session);
        if (Date.now() - timestamp > 24 * 60 * 60 * 1000) { // 24h expiry
            localStorage.removeItem('player_session');
            return null;
        }
        
        const existing = JSON.parse(localStorage.getItem('matchup_players') || '[]');
        const player = existing.find((p: any) => p.id === id);
        
        // If we have a session but no player in cache, return a partial object
        // so the UI knows we are authenticated, then the component can fetch the full profile.
        if (!player) {
            return {
                id,
                name: 'Loading...',
                email: '',
                phone: '',
                skillLevel: SkillLevel.INTERMEDIATE,
                verified: false,
                isPartial: true // Flag to indicate this needs a full fetch
            } as any;
        }
        
        return player;
    } catch (e) {
        console.error("Error parsing player session:", e);
        return null;
    }
};
export const getPlayerById = async (id: string) => {

    // Check local cache first
    const existing = JSON.parse(localStorage.getItem('matchup_players') || '[]');
    const cached = existing.find((p: any) => p.id === id);
    if (cached) return cached;

    // Fetch from Firestore
    if (db) {
        try {
            const playerRef = doc(db, 'players', id);
            const playerSnap = await getDoc(playerRef);
            if (playerSnap.exists()) {
                const player = playerSnap.data() as PlayerProfile;
                
                // Update cache
                existing.push(player);
                localStorage.setItem('matchup_players', JSON.stringify(existing));
                
                return player;
            }
        } catch (error) {
            console.error("Error fetching player from Firestore:", error);
        }
    }
    
    return null;
};

export const subscribeToPlayer = (playerId: string, cb: (data: any) => void) => {
    if (!db) return () => {};
    const docRef = doc(db, 'players', playerId);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            cb({ id: docSnap.id, ...docSnap.data() });
        }
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, `players/${playerId}`);
    });
};

export const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage not initialized");
    const timestamp = Date.now();
    const storageRef = ref(storage, `profilePictures/${userId}_${timestamp}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

export const uploadSystemImage = async (folder: string, file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage not initialized");
    const timestamp = Date.now();
    const storageRef = ref(storage, `${folder}/${timestamp}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

export const updatePlayerProfile = async (playerId: string, updates: any) => {
    let updatedPlayer = null;
    const existing = JSON.parse(localStorage.getItem('matchup_players') || '[]');
    const index = existing.findIndex((p: any) => p.id === playerId);

    if (index > -1) {
        existing[index] = { ...existing[index], ...updates };
        localStorage.setItem('matchup_players', JSON.stringify(existing));
        updatedPlayer = existing[index];
    }

    if (db) {
        try {
            const playerRef = doc(db, 'players', playerId);
            await updateDoc(playerRef, updates);
            const userSnap = await getDoc(playerRef);
            if (userSnap.exists()) {
                updatedPlayer = userSnap.data();
                await syncSingleStandalonePlayerToGlobal(updatedPlayer);
            }
        } catch (error) {
            console.error("Error updating player in Firestore:", error);
        }
    }

    return updatedPlayer;
};

export const getPlayerSquads = (playerId: string) => {
    const squads = JSON.parse(localStorage.getItem('matchup_squads') || '[]');
    return squads.filter((s: any) => s.ownerId === playerId);
};

export const createSquad = async (squadData: any) => {
    const squads = JSON.parse(localStorage.getItem('matchup_squads') || '[]');
    const newSquad = {
        id: genId(),
        ...squadData,
        createdAt: new Date().toISOString()
    };
    squads.push(newSquad);
    localStorage.setItem('matchup_squads', JSON.stringify(squads));
    return newSquad;
};

export const deleteSquad = async (squadId: string) => {
    let squads = JSON.parse(localStorage.getItem('matchup_squads') || '[]');
    squads = squads.filter((s: any) => s.id !== squadId);
    localStorage.setItem('matchup_squads', JSON.stringify(squads));
};
export const rateMatchOpponent = async (tournamentId: string, matchId: string, rating: any) => {

    const tRef = doc(db, 'tournaments', tournamentId);
    const snap = await getDoc(tRef);
    
    const t = snap.data() as Tournament;
    const matchIndex = t.matches.findIndex(m => m.id === matchId);
    
    const match = t.matches[matchIndex];
    if ((match.status !== 'COMPLETED' && String(match.status).toUpperCase() !== 'FINISHED')) {
        throw new Error("Can only rate completed matches");
    }
    
    if (!match.ratings) {
        match.ratings = [];
    }
    
    // Prevent duplicate ratings
    const existingIndex = match.ratings.findIndex(r => r.raterPlayerId === rating.raterPlayerId && r.ratedPlayerId === rating.ratedPlayerId);
    if (existingIndex > -1) {
        match.ratings[existingIndex] = rating;
    } else {
        match.ratings.push(rating);
    }
    
    t.matches[matchIndex] = match;
    await updateDoc(tRef, { matches: t.matches });
};

// ------------------------------------------------------------------
// EXPORT FUNCTIONS
// ------------------------------------------------------------------

export const subscribeToVenues = (cb: (data: Venue[]) => void) => {
    if (db) {
        const q = query(collection(db, "venues"), where("status", "==", "ACTIVE"));
        return onSnapshot(q, (snapshot: any) => {
            const venues = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Venue));
            cb(venues);
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, "venues");
        });
    } else {
        // Mock fallback
        cb([]);
        return () => {};
    }
};

export const subscribeToTournaments = (cb: (data: Tournament[]) => void, organizerId?: string, organizerEmail?: string) => {
    if (db) {
        if (organizerId || organizerEmail) {
            // Fetch by organizerId, organizerEmail, and adminTag
            const qId = query(collection(db, "tournaments"), where("organizerId", "==", organizerId || ""));
            const qEmail = organizerEmail ? query(collection(db, "tournaments"), where("organizerEmail", "==", organizerEmail)) : null;
            const qTag = organizerEmail ? query(collection(db, "tournaments"), where("adminTag", "==", organizerEmail)) : null;

            let docsId: Tournament[] = [];
            let docsEmail: Tournament[] = [];
            let docsTag: Tournament[] = [];

            const emitMerged = () => {
                const mergedMap: Record<string, Tournament> = {};
                docsId.forEach(t => { mergedMap[t.id] = t; });
                docsEmail.forEach(t => { mergedMap[t.id] = t; });
                docsTag.forEach(t => { mergedMap[t.id] = t; });

                const tours = Object.values(mergedMap);
                tours.sort((a, b) => {
                    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return bTime - aTime;
                });
                cb(tours);
            };

            const unsubId = onSnapshot(qId, (snapshot: any) => {
                docsId = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Tournament));
                emitMerged();
            }, (error) => {
                handleFirestoreError(error, OperationType.LIST, `tournaments-id-${organizerId}`);
            });

            const unsubEmail = qEmail ? onSnapshot(qEmail, (snapshot: any) => {
                docsEmail = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Tournament));
                emitMerged();
            }, (error) => {
                handleFirestoreError(error, OperationType.LIST, `tournaments-email-${organizerEmail}`);
            }) : () => {};

            const unsubTag = qTag ? onSnapshot(qTag, (snapshot: any) => {
                docsTag = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Tournament));
                emitMerged();
            }, (error) => {
                handleFirestoreError(error, OperationType.LIST, `tournaments-tag-${organizerEmail}`);
            }) : () => {};

            return () => {
                unsubId();
                unsubEmail();
                unsubTag();
            };
        } else {
            const q = query(collection(db, "tournaments"));
            return onSnapshot(q, (snapshot: any) => {
                const tours = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Tournament));
                tours.sort((a, b) => {
                    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return bTime - aTime;
                });
                cb(tours);
            }, (error) => {
                handleFirestoreError(error, OperationType.LIST, "tournaments");
            });
        }
    } else {
        let safeData = cleanData(mockTournaments);
        if (organizerId) {
            safeData = safeData.filter(t => t.organizerId === organizerId || (organizerEmail && (t.organizerEmail === organizerEmail || t.adminTag === organizerEmail)));
        }
        cb(safeData);
        const wrappedCb = (data: Tournament[]) => {
            let fd = cleanData(data);
            if (organizerId) {
                fd = fd.filter(t => t.organizerId === organizerId || (organizerEmail && (t.organizerEmail === organizerEmail || t.adminTag === organizerEmail)));
            }
            cb(fd);
        };
        listeners.push(wrappedCb);
        return () => { const idx = listeners.indexOf(wrappedCb); if (idx > -1) listeners.splice(idx, 1); };
    }
};

export const subscribeToTournament = (id: string, cb: (data: Tournament | null) => void) => {
    if (db) {
        let tData: Tournament | null = null;
        let sData: Sponsor[] = [];
        let mData: Match[] | null = null;
        let unsubS: any = null;
        let unsubM: any = null;
        
        const emit = () => {
            if (tData) {
                const finalData = { ...tData };
                finalData.sponsors = sData;
                if (mData !== null) {
                    finalData.matches = mData;
                }
                cb(finalData);
            } else {
                cb(null);
            }
        };

        const setupSubcollections = (tId: string) => {
            if (unsubS) unsubS();
            if (unsubM) unsubM();

            unsubS = onSnapshot(collection(db, "tournaments", tId, "sponsors"), (snap) => {
                sData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor));
                emit();
            });

            unsubM = onSnapshot(query(collection(db, "matches"), where("tournamentId", "==", tId)), (snap) => {
                mData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
                emit();
            });
        };

        // First, check if it's a direct ID
        const docRef = doc(db, "tournaments", id);
        let actualUnsubT = null;
        const unsubT = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                tData = { id: snap.id, ...snap.data() } as Tournament;
                setupSubcollections(snap.id);
                emit();
            } else {
                // If not found by ID, try searching by slug
                const q = query(collection(db, "tournaments"), where("slug", "==", id), limit(1));
                getDocs(q).then((slugSnap) => {
                    if (!slugSnap.empty) {
                        const d = slugSnap.docs[0];
                        // We still want to listen to the actual document for real-time updates
                        const actualDocRef = doc(db, "tournaments", d.id);
                        if (actualUnsubT) actualUnsubT();
                        actualUnsubT = onSnapshot(actualDocRef, (realSnap) => {
                            if (realSnap.exists()) {
                                tData = { id: realSnap.id, ...realSnap.data() } as Tournament;
                                setupSubcollections(realSnap.id);
                                emit();
                            }
                        });
                    } else {
                        tData = null;
                        emit();
                    }
                });
            }
        });

        return () => { 
            unsubT();
            if (actualUnsubT) actualUnsubT(); 
            unsubT(); 
            if (unsubS) unsubS(); 
            if (unsubM) unsubM(); 
        };
    } else {
        const t = mockTournaments.find(x => x.id === id || x.slug === id) || null;
        cb(t ? cleanData(t) : null);
        const listener = { id, cb };
        tournamentListeners.push(listener);
        return () => { const idx = tournamentListeners.indexOf(listener); if (idx > -1) tournamentListeners.splice(idx, 1); };
    }
};

export const getOrganiserCredits = async (uid: string) => {
    if (!db) {
        const stored = localStorage.getItem(`organizerCredits-${uid}`);
        if (stored) return JSON.parse(stored);
        return { matchCreditsRemaining: 100, matchCreditsUsed: 0 }; // Default mock
    }
    try {
        const docRef = doc(db, 'organisers', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data();
        }
        return null; // Return null if active package doesn't exist
    } catch (err) {
        console.error("Failed to get organiser credits", err);
        return null;
    }
};

export const deductOrganiserCredits = async (uid: string, creditsToDeduct: number) => {
    if (!db) {
        const stored = localStorage.getItem(`organizerCredits-${uid}`);
        let data = stored ? JSON.parse(stored) : { matchCreditsRemaining: 100, matchCreditsUsed: 0 };
        if (data.matchCreditsRemaining < creditsToDeduct) return false;
        data.matchCreditsRemaining -= creditsToDeduct;
        data.matchCreditsUsed += creditsToDeduct;
        localStorage.setItem(`organizerCredits-${uid}`, JSON.stringify(data));
        return true;
    }
    try {
        const docRef = doc(db, 'organisers', uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return false;
        
        const data = snap.data();
        const currentRemaining = data.matchCreditsRemaining || 0;
        const currentUsed = data.matchCreditsUsed || 0;
        
        if (currentRemaining < creditsToDeduct) {
            return false;
        }

        await updateDoc(docRef, {
            matchCreditsRemaining: currentRemaining - creditsToDeduct,
            matchCreditsUsed: currentUsed + creditsToDeduct
        });
        return true;
    } catch (err) {
        console.error("Failed to deduct credits", err);
        return false;
    }
};

export const refundOrganiserCredits = async (uid: string, creditsToRefund: number) => {
    if (!db) {
        const stored = localStorage.getItem(`organizerCredits-${uid}`);
        let data = stored ? JSON.parse(stored) : { matchCreditsRemaining: 100, matchCreditsUsed: 0 };
        data.matchCreditsRemaining += creditsToRefund;
        data.matchCreditsUsed = Math.max(0, data.matchCreditsUsed - creditsToRefund);
        localStorage.setItem(`organizerCredits-${uid}`, JSON.stringify(data));
        return true;
    }
    try {
        const docRef = doc(db, 'organisers', uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return false;
        
        const data = snap.data();
        const currentRemaining = data.matchCreditsRemaining || 0;
        const currentUsed = data.matchCreditsUsed || 0;

        await updateDoc(docRef, {
            matchCreditsRemaining: currentRemaining + creditsToRefund,
            matchCreditsUsed: Math.max(0, currentUsed - creditsToRefund)
        });
        return true;
    } catch (err) {
        console.error("Failed to refund credits", err);
        return false;
    }
};

export const retireTournament = async (tId: string) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        await updateDoc(tRef, { status: 'RETIRED' });
    } else {
        const index = mockTournaments.findIndex(t => t.id === tId);
        if (index > -1) {
            mockTournaments[index].status = 'RETIRED';
            notifyMock();
        }
    }
};

export const createTournament = async (t: any) => {
    // Extract sponsors and matches to save separately
    const { sponsors, matches, ...mainData } = t;

    const newT: any = { 
        ...mainData, 
        teams: [], 
        // We don't save matches in the main doc anymore to keep it light
        matches: [], 
        status: 'ACTIVE', 
        slug: slugify(mainData.name || 'tournament'),
        createdAt: new Date().toISOString(),
        organizerId: t.organizerId || auth?.currentUser?.uid || '', // <--- Added organizerId
        organizerEmail: t.organizerEmail || auth?.currentUser?.email || '',
        adminTag: t.adminTag || auth?.currentUser?.email || ''
    };

    if (!newT.adminTag) {
        throw new Error("Tournament must have an adminTag.");
    }

    if (db) {
        // Save main doc
        const docRef = await addDoc(collection(db, "tournaments"), cleanData(newT));

        
        // Save sponsors to subcollection
        if (sponsors && sponsors.length > 0) {
            await saveSponsorsToSubCollection(docRef.id, sponsors);
        }

        // Save matches to subcollection (if any generated initially)
        if (matches && matches.length > 0) {
            const batch = writeBatch(db);
            const matchesCol = collection(db, "tournaments", docRef.id, "matches");
            const globalMatchesCol = collection(db, "matches");
            matches.forEach((m: Match) => {
                const mRef = doc(matchesCol, m.id);
                const gRef = doc(globalMatchesCol, m.id);
                batch.set(mRef, cleanData(m));
                batch.set(gRef, cleanData({ ...m, tournamentId: docRef.id }));
            });
            await batch.commit();
        }

        return docRef.id;
    } else {
        newT.id = genId();
        // For mock, we keep sponsors and matches inline
        if (sponsors) newT.sponsors = sponsors;
        if (matches) newT.matches = matches;
        mockTournaments = [newT, ...mockTournaments];
        notifyMock();
        return newT.id;
    }
};

export const updateTournament = async (tId: any, data: any, ...args: any[]) => {
    // Extract sponsors, matches, teams, and adminTag to prevent overwriting them during settings update
    const { sponsors, matches, teams, adminTag, ...mainData } = data;

    if (db) {
        const tRef = doc(db, "tournaments", tId);
        
        // Update main doc
        if (Object.keys(mainData).length > 0) {
            const updateObj: any = { ...cleanData(mainData), sponsors: deleteField() };
            if (mainData.name) {
                updateObj.slug = slugify(mainData.name);
            }
            await updateDoc(tRef, updateObj);
        } else {
            // Even if no main data update, ensure we clean legacy sponsors
             await updateDoc(tRef, { sponsors: deleteField() });
        }

        // Handle Sponsors Subcollection update if sponsors array is provided
        if (sponsors) {
            await saveSponsorsToSubCollection(tId, sponsors);
        }

        // Handle Matches Subcollection update if matches array is provided (e.g. from generateSchedule or manual update)
        // Note: Usually we update specific matches, but if a full list is provided, we might want to sync it.
        // For now, let's assume updateTournament is mostly for settings/metadata.
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            Object.assign(t, mainData);
            if (sponsors) t.sponsors = sponsors;
            if (matches) t.matches = matches;
            notifyMock();
        }
    }
};

export const deleteTournament = async (tId: any, ...args: any[]) => {
    if (db) {
        await deleteDoc(doc(db, "tournaments", tId));
        // Note: Subcollections are not automatically deleted in Firestore. 
    } else {
        mockTournaments = mockTournaments.filter(t => t.id !== tId);
        notifyMock();
    }
};

export const searchGlobalTeams = async (searchQuery: string): Promise<Team[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, "tournaments"));
        const snap = await getDocs(q);
        const allTeams: Team[] = [];
        const seenIds = new Set<string>();
        
        snap.forEach(doc => {
            const t = doc.data() as Tournament;
            if (t.teams) {
                t.teams.forEach(team => {
                    if (team.status === 'ACCEPTED' && !seenIds.has(team.id)) {
                        if (team.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            team.player1?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            team.player2?.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
                            
                            // Include source tournament ID so user knows where it's from
                            allTeams.push({ ...team, _sourceTournament: t.id } as any);
                            seenIds.add(team.id);
                        }
                    }
                });
            }
        });
        return allTeams.slice(0, 15); // Return top 15 results
    } catch (e) {
        console.error("Failed to search global teams", e);
        return [];
    }
};

export const verifyPlayerEmail = async (player: any) => {
    if (!db || !player || !player.email) return player;
    try {
        const playersRef = collection(db, 'players');
        const q = query(playersRef, where('email', '==', player.email.toLowerCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
            return { ...player, verified: true };
        }
    } catch (e) {
        console.error("Error verifying player email", e);
    }
    return player;
};

export const registerTeam = async (tId: string, team: any) => {
    let { registeredBy, ...rest } = team;
    
    // Auto-verify players if accounts exist
    if (db) {
        rest.player1 = await verifyPlayerEmail(rest.player1);
        rest.player2 = await verifyPlayerEmail(rest.player2);
    }
    
    const newTeam = { ...rest, id: genId(), status: 'PENDING', registeredAt: new Date().toISOString(), registeredBy: registeredBy || null };
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            await updateDoc(tRef, cleanData({ teams: [...(tData.teams||[]), newTeam] }));
            await syncTournamentPlayersAndTeams(tId);

            if (registeredBy) {
                try {
                    const referralsRef = collection(db, 'referrals');
                    await addDoc(referralsRef, {
                        referrerId: registeredBy,
                        tournamentId: tId,
                        teamName: newTeam.name,
                        p1Email: newTeam.player1?.email || '',
                        p2Email: newTeam.player2?.email || '',
                        createdAt: new Date().toISOString()
                    });
                } catch (e) {
                    console.error("Failed to add referral record", e);
                }
            }
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) { t.teams.push(newTeam); notifyMock(); }
        syncTournamentPlayersAndTeams(tId);
    }
};

export const enrollTeamManually = async (tId: string, team: Omit<Team, 'id' | 'status'>) => {
    let t = { ...team };
    if (db) {
        t.player1 = await verifyPlayerEmail(t.player1);
        t.player2 = await verifyPlayerEmail(t.player2);
    }
    const newTeam = { ...t, id: genId(), status: 'ACCEPTED', registeredAt: new Date().toISOString() };
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            await updateDoc(tRef, cleanData({ teams: [...(tData.teams||[]), newTeam] }));
            await syncTournamentPlayersAndTeams(tId);

            // Send confirmation emails
            const mailCollection = collection(db, 'mail');
            const players = [newTeam.player1, newTeam.player2].filter(p => !!p.email);
            
            for (const player of players) {
                await addDoc(mailCollection, {
                    to: player.email,
                    message: {
                        subject: `Welcome to ${tData.name}!`,
                        from: "Match Up Tournaments <info@matchup.com.pk>",
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                                ${tData.bannerUrl ? `<img src="${tData.bannerUrl}" alt="${tData.name}" style="width: 100%; border-radius: 12px; margin-bottom: 20px;" />` : ''}
                                        <h2>You're in!</h2>
                                        <p>Hi ${player.name},</p>
                                        <p>You have been successfully enrolled in <strong>${tData.name}</strong> as part of the team <strong>${newTeam.name}</strong>.</p>
                                        <p>Get ready for the matches!</p>
                                        <div style="margin-top: 30px; text-align: center;"><a href="https://matchup.com.pk" style="background-color: #4D78FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Match Up</a></div>
                                    </div>
                        `
                    }
                });
            }
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) { t.teams.push(newTeam as any); notifyMock(); }
        syncTournamentPlayersAndTeams(tId);
    }
    return newTeam.id;
};

export const updateTeamPlayers = async (tId: string, teamId: string, player1: Player, player2: Player) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            const updatedTeams = (tData.teams || []).map(tm => tm.id === teamId ? { ...tm, player1, player2 } : tm);
            await updateDoc(tRef, cleanData({ teams: updatedTeams }));
            await syncTournamentPlayersAndTeams(tId);
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.teams = t.teams.map((tm: any) => tm.id === teamId ? { ...tm, player1, player2 } : tm);
            notifyMock();
            syncTournamentPlayersAndTeams(tId);
        }
    }
};

export const updateTeamStatus = async (tId: string, teamId: string, status: string) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            const updatedTeams = (tData.teams || []).map(tm => {
                if (tm.id === teamId) {
                    let resolvedCatId = tm.categoryId;
                    const catNameMatch = tData.categories?.find(c => c.name.toLowerCase().trim() === String(tm.categoryId || '').toLowerCase().trim());
                    if (catNameMatch) {
                        resolvedCatId = catNameMatch.id;
                    }
                    return { ...tm, categoryId: resolvedCatId, status: status as any };
                }
                return tm;
            });

            if (status === 'REJECTED') {
                const rejectedTeam = updatedTeams.find(tm => tm.id === teamId);
                // "not be tagged to the tournament" -> remove from teams array
                const filteredTeams = updatedTeams.filter(tm => tm.id !== teamId);
                await updateDoc(tRef, cleanData({ teams: filteredTeams }));
                
                if (rejectedTeam) {
                    // "remain in the database" -> keep in onboardedTeams
                    const obRef = doc(db, 'onboardedTeams', rejectedTeam.id);
                    await setDoc(obRef, cleanData({
                        ...rejectedTeam,
                        status: 'REJECTED',
                        onboardedAt: new Date().toISOString()
                    }), { merge: true });

                    const mailCollection = collection(db, 'mail');
                    const players = [rejectedTeam.player1, rejectedTeam.player2].filter(p => !!p?.email);
                    
                    for (const player of players) {
                        await addDoc(mailCollection, {
                            to: player.email,
                            message: {
                                subject: `Update on your registration for ${tData.name}`,
                                from: "Match Up Tournaments <info@matchup.com.pk>",
                                html: `
                                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                                        <h2>Registration Update</h2>
                                        <p>Hi ${player.name},</p>
                                        <p>Unfortunately, your team's registration request for <strong>${tData.name}</strong> has been rejected or cancelled by the administration.</p>
                                        <p>If you have any questions, please contact the tournament organizers.</p>
                                    </div>
                                `
                            }
                        });
                    }
                }
            } else {
                await updateDoc(tRef, cleanData({ teams: updatedTeams }));
                
                if (status === 'ACCEPTED') {
                    const acceptedTeam = updatedTeams.find(tm => tm.id === teamId);
                    if (acceptedTeam) {
                        const obRef = doc(db, 'onboardedTeams', acceptedTeam.id);
                        await setDoc(obRef, cleanData({
                            ...acceptedTeam,
                            tournamentId: tId,
                            tournamentName: tData.name,
                            categoryName: tData.categories?.find(c => c.id === acceptedTeam.categoryId)?.name || 'Unknown',
                            onboardedAt: new Date().toISOString()
                        }), { merge: true });

                        const mailCollection = collection(db, 'mail');
                        const players = [acceptedTeam.player1, acceptedTeam.player2].filter(p => !!p?.email);
                        
                        for (const player of players) {
                            await addDoc(mailCollection, {
                                to: player.email,
                                message: {
                                    subject: `Welcome to ${tData.name}!`,
                                    from: "Match Up Tournaments <info@matchup.com.pk>",
                                    html: `
                                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                                            ${tData.bannerUrl ? `<img src="${tData.bannerUrl}" alt="${tData.name}" style="width: 100%; border-radius: 12px; margin-bottom: 20px;" />` : ''}
                                            <h2>You're in!</h2>
                                            <p>Hi ${player.name},</p>
                                            <p>Your team registration for <strong>${tData.name}</strong> has been accepted!</p>
                                            <p>Get ready for the matches!</p>
                                            <div style="margin-top: 30px; text-align: center;"><a href="https://matchup.com.pk" style="background-color: #4D78FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Match Up</a></div>
                                        </div>
                                    `
                                }
                            });
                        }
                    }
                }
            }
            await syncTournamentPlayersAndTeams(tId);
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.teams = t.teams.map(tm => tm.id === teamId ? { ...tm, status: status as any } : tm);
            notifyMock();
            syncTournamentPlayersAndTeams(tId);
        }
    }
};

export const assignTeamGroup = async (tId: string, teamId: string, groupId: string) => {
    await updateTournamentTeamsGroups(tId, { [teamId]: groupId });
};

export const updateTournamentTeamsGroups = async (tId: string, updates: Record<string, string>) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            let updatedTeams = [...(tData.teams || [])];
            for (const [teamId, groupId] of Object.entries(updates)) {
                 updatedTeams = updatedTeams.map(tm => tm.id === teamId ? { ...tm, groupId } : tm);
            }
            await updateDoc(tRef, cleanData({ teams: updatedTeams }));
            await syncTournamentPlayersAndTeams(tId);
            
            // Sync group change to standings subcollection
            for (const [teamId, groupId] of Object.entries(updates)) {
                const sRef = doc(db, "tournaments", tId, "standings", teamId);
                const sSnap = await getDoc(sRef);
                if (sSnap.exists()) {
                    await updateDoc(sRef, { groupId });
                }
            }
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            for (const [teamId, groupId] of Object.entries(updates)) {
                 t.teams = t.teams.map(tm => tm.id === teamId ? { ...tm, groupId } : tm);
            }
            notifyMock();
        }
    }
};

// --- HELPER FUNCTIONS ---

const calculateSchedule = (tournament: Tournament, knockoutConfig?: any[], autoConfig?: AutoScheduleConfig): Match[] => {
    let teams = tournament.teams?.filter(t => t.status === 'ACCEPTED') || [];
    if (autoConfig?.categoryId) {
        teams = teams.filter(t => t.categoryId === autoConfig.categoryId);
    }
    
    if (teams.length < 2) {
        console.warn('Not enough accepted teams to generate schedule for', autoConfig?.categoryId || 'tournament');
        return [];
    }

    const activeFormat = autoConfig?.categoryId 
        ? (tournament.categories?.find(c => c.id === autoConfig.categoryId)?.format || tournament.format) 
        : tournament.format;

    let matches: Match[] = [];
    let matchCounter = 1;

    // Helper for creating match object
    const createMatchBase = (t1Id: string | undefined, t2Id: string | undefined, round: number, roundName: string, stage: string): Match => {
        const t1 = t1Id && t1Id !== 'BYE' && t1Id !== '' ? tournament.teams?.find(t => t.id === t1Id) : null;
        const t2 = t2Id && t2Id !== 'BYE' && t2Id !== '' ? tournament.teams?.find(t => t.id === t2Id) : null;
        const initialTime = new Date().toISOString();
        
        return {
            id: `m_${Date.now()}_${matchCounter++}`,
            tournamentId: tournament.id,
            categoryId: autoConfig?.categoryId || undefined,
            team1Id: t1Id || '',
            team2Id: t2Id || '',
            team1Name: t1?.name || (t1Id === 'BYE' ? 'BYE' : ''),
            team2Name: t2?.name || (t2Id === 'BYE' ? 'BYE' : ''),
            team1PlayerNames: t1 ? [t1.player1?.name, t1.player2?.name].filter(Boolean).join(' & ') : '',
            team2PlayerNames: t2 ? [t2.player1?.name, t2.player2?.name].filter(Boolean).join(' & ') : '',
            status: MatchStatus.SCHEDULED,
            score: {
                p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0,
                p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [],
                currentSet: 1, isTiebreak: false, history: []
            },
            court: '"TBD"',
            courtId: '"TBD"',
            scheduledCourtId: '"TBD"',
            scheduledStartTime: initialTime,
            actualCourtId: null,
            courtOverrideBy: null,
            courtOverrideAt: null,
            conflictAcknowledged: null,
            scheduledTime: initialTime,
            round,
            roundName,
            stage: stage
        };
    };

    if (activeFormat === TournamentFormat.SINGLE_ELIMINATION) {
        // Proper Single Elimination Bracket with seeding
        const sortedTeams = [...teams];
        if (autoConfig?.useSeeding) {
            // Sort by points or sets won as a proxy for seeding
            sortedTeams.sort((a, b) => (b.points || 0) - (a.points || 0));
        }

        const teamCount = sortedTeams.length;
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teamCount)));
        const byes = nextPowerOf2 - teamCount;

        const teamsWithByes: (Team | { id: 'BYE', name: 'BYE' })[] = [...sortedTeams];
        for (let i = 0; i < byes; i++) teamsWithByes.push({ id: 'BYE', name: 'BYE' } as any);

        // Seeding logic (1 vs 8, 4 vs 5, etc)
        const seededOrder: any[] = [];
        const n = teamsWithByes.length;
        for (let i = 0; i < n / 2; i++) {
            seededOrder.push(teamsWithByes[i]);
            seededOrder.push(teamsWithByes[n - 1 - i]);
        }

        const r1Matches: Match[] = [];
        for (let i = 0; i < seededOrder.length; i += 2) {
            const t1 = seededOrder[i];
            const t2 = seededOrder[i+1];
            
            const match = createMatchBase(t1.id === 'BYE' ? undefined : t1.id, t2.id === 'BYE' ? undefined : t2.id, 1, 'Round of ' + nextPowerOf2, 'KNOCKOUT');
            
            if (t1.id === 'BYE' || t2.id === 'BYE') {
                const winner = t1.id === 'BYE' ? t2 : t1;
                match.winnerTeamId = winner.id;
                match.status = MatchStatus.COMPLETED;
                match.roundName = 'Bye';
            }
            r1Matches.push(match);
        }
        matches = [...r1Matches];

        // Generate placeholders for next rounds
        let currentLevelMatches = matches;
        let roundNum = 2;
        while (currentLevelMatches.length > 1) {
            const nextLevelMatches: Match[] = [];
            for (let i = 0; i < currentLevelMatches.length; i += 2) {
                const m1 = currentLevelMatches[i];
                const m2 = currentLevelMatches[i+1];
                const nextM = createMatchBase(undefined, undefined, roundNum, `Round ${roundNum}`, 'KNOCKOUT');
                
                m1.nextMatchId = nextM.id;
                m2.nextMatchId = nextM.id;
                
                nextM.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: m1.id };
                nextM.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: m2.id };

                nextLevelMatches.push(nextM);
            }
            matches = [...matches, ...nextLevelMatches];
            currentLevelMatches = nextLevelMatches;
            roundNum++;
        }
        if (matches.length > 0) {
            const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a,b) => b - a); // Highest round first
            let isFinal = true;
            for (const r of rounds) {
                const roundMatches = matches.filter(m => m.round === r);
                if (isFinal && roundMatches.length === 1) {
                    roundMatches[0].roundName = 'Final';
                    isFinal = false;
                } else if (roundMatches.length === 2) {
                    roundMatches[0].roundName = 'Semi-Final 1';
                    roundMatches[1].roundName = 'Semi-Final 2';
                } else if (roundMatches.length === 4) {
                    roundMatches.forEach((m, idx) => m.roundName = `Quarter-Final ${idx + 1}`);
                } else if (roundMatches.length === 8) {
                    roundMatches.forEach((m, idx) => m.roundName = `Round of 16 - Match ${idx + 1}`);
                } else {
                    roundMatches.forEach((m, idx) => m.roundName = `Round ${r} - Match ${idx + 1}`);
                }
            }
        }

    } else if (activeFormat === TournamentFormat.ROUND_ROBIN) {
        const rrType = autoConfig?.categoryId 
            ? (tournament.categories?.find((c: any) => c.id === autoConfig.categoryId)?.rrType || tournament.rrType) 
            : tournament.rrType;

        const getGroup = (t: Team) => t.groupId || 'A';
        const distinctGroups = Array.from(new Set(teams.map(getGroup)));
        
        // If there's more than 1 distinct group assigned by user, OR if the format type explicitly requests grouping, use group-based scheduling.
        if (distinctGroups.length > 1 || rrType === RoundRobinType.GROUP_SINGLE || rrType === RoundRobinType.GROUP_DOUBLE) {
            distinctGroups.forEach(group => {
                const groupTeams = teams.filter(t => getGroup(t) === group);
                for (let i = 0; i < groupTeams.length; i++) {
                    for (let j = i + 1; j < groupTeams.length; j++) {
                        matches.push(createMatchBase(groupTeams[i].id, groupTeams[j].id, 1, `Group ${group}`, 'GROUP'));
                        if (rrType === RoundRobinType.GROUP_DOUBLE || rrType === RoundRobinType.DOUBLE) {
                            matches.push(createMatchBase(groupTeams[j].id, groupTeams[i].id, 1, `Group ${group} (Reverse)`, 'GROUP'));
                        }
                    }
                }
            });
        } else {
            const rrTeams = [...teams];
            const groupName = distinctGroups.length === 1 ? `Group ${distinctGroups[0]}` : 'Round Robin';
            for (let i = 0; i < rrTeams.length; i++) {
                for (let j = i + 1; j < rrTeams.length; j++) {
                    matches.push(createMatchBase(rrTeams[i].id, rrTeams[j].id, 1, groupName, 'GROUP'));
                    if (rrType === RoundRobinType.DOUBLE) {
                        matches.push(createMatchBase(rrTeams[j].id, rrTeams[i].id, 1, `${groupName} (Reverse)`, 'GROUP'));
                    }
                }
            }
        }
    } else if (activeFormat === TournamentFormat.GROUP_TO_KNOCKOUT) {
        const rrType = autoConfig?.categoryId 
            ? (tournament.categories?.find(c => c.id === autoConfig.categoryId)?.rrType || tournament.rrType) 
            : tournament.rrType;
            
        const getGroup = (t: Team) => t.groupId || 'A';
        const groups = Array.from(new Set(teams.map(getGroup)));
        groups.forEach(group => {
            const groupTeams = teams.filter(t => getGroup(t) === group);
            for (let i = 0; i < groupTeams.length; i++) {
                for (let j = i + 1; j < groupTeams.length; j++) {
                    matches.push(createMatchBase(groupTeams[i].id, groupTeams[j].id, 1, `Group ${group}`, 'GROUP'));
                    if (rrType === RoundRobinType.GROUP_DOUBLE || rrType === RoundRobinType.DOUBLE) {
                        matches.push(createMatchBase(groupTeams[j].id, groupTeams[i].id, 1, `Group ${group} (Reverse)`, 'GROUP'));
                    }
                }
            }
        });

        if (groups.length === 4) {
            const knockoutStartRound = 2;
            const q1 = createMatchBase(undefined, undefined, knockoutStartRound, 'Quarter-Final 1', 'KNOCKOUT');
            q1.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[0], rank: 1 };
            q1.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[1], rank: 2 };

            const q2 = createMatchBase(undefined, undefined, knockoutStartRound, 'Quarter-Final 2', 'KNOCKOUT');
            q2.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[2], rank: 1 };
            q2.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[3], rank: 2 };

            const q3 = createMatchBase(undefined, undefined, knockoutStartRound, 'Quarter-Final 3', 'KNOCKOUT');
            q3.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[1], rank: 1 };
            q3.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[0], rank: 2 };

            const q4 = createMatchBase(undefined, undefined, knockoutStartRound, 'Quarter-Final 4', 'KNOCKOUT');
            q4.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[3], rank: 1 };
            q4.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[2], rank: 2 };

            const s1 = createMatchBase(undefined, undefined, knockoutStartRound + 1, 'Semi-Final 1', 'KNOCKOUT');
            s1.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: q1.id };
            s1.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: q2.id };
            q1.nextMatchId = s1.id;
            q2.nextMatchId = s1.id;

            const s2 = createMatchBase(undefined, undefined, knockoutStartRound + 1, 'Semi-Final 2', 'KNOCKOUT');
            s2.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: q3.id };
            s2.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: q4.id };
            q3.nextMatchId = s2.id;
            q4.nextMatchId = s2.id;

            const f = createMatchBase(undefined, undefined, knockoutStartRound + 2, 'Final', 'KNOCKOUT');
            f.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: s1.id };
            f.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: s2.id };
            s1.nextMatchId = f.id;
            s2.nextMatchId = f.id;
            
            matches = [...matches, q1, q2, q3, q4, s1, s2, f];
        } else if (groups.length >= 2) {
            const knockoutStartRound = 2;
            const s1 = createMatchBase(undefined, undefined, knockoutStartRound, 'Semi-Final 1', 'KNOCKOUT');
            s1.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[0], rank: 1 };
            s1.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[1%groups.length], rank: 2 };
            
            const s2 = createMatchBase(undefined, undefined, knockoutStartRound, 'Semi-Final 2', 'KNOCKOUT');
            s2.team1Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[1%groups.length], rank: 1 };
            s2.team2Dependency = { sourceType: 'GROUP_RANK', sourceId: groups[0], rank: 2 };

            const f = createMatchBase(undefined, undefined, knockoutStartRound + 1, 'Final', 'KNOCKOUT');
            f.team1Dependency = { sourceType: 'MATCH_WINNER', sourceId: s1.id };
            f.team2Dependency = { sourceType: 'MATCH_WINNER', sourceId: s2.id };
            s1.nextMatchId = f.id;
            s2.nextMatchId = f.id;
            matches = [...matches, s1, s2, f];
        }
    } else if (activeFormat === TournamentFormat.AMERICANO || activeFormat === TournamentFormat.MEXICANO) {
        const rawPlayers = teams.map(t => ({ id: t.id, name: t.name }));
        const genIdStr = () => Math.random().toString(36).substr(2, 9);
        let matchCounter = 1;

        if (activeFormat === TournamentFormat.AMERICANO) {
            const N = rawPlayers.length;
            if (N < 4 || N % 4 !== 0) {
                throw new Error(`Total players must be a multiple of 4 (e.g., 4, 8, 12, 16) so no one sits out. Currently accepted: ${N}`);
            }

            // Shuffle/randomize the initial player setup
            const shuffledPlayers = [...rawPlayers].sort(() => Math.random() - 0.5);

            const totalRounds = N - 1;
            const matchesPerRound = N / 4;
            const mod = (val: number, n: number) => ((val % n) + n) % n;

            for (let r = 0; r < totalRounds; r++) {
                const R: typeof rawPlayers = new Array(N);
                R[0] = shuffledPlayers[0];
                for (let i = 1; i < N; i++) {
                    R[i] = shuffledPlayers[mod(i - 1 - r, N - 1) + 1];
                }

                for (let m = 0; m < matchesPerRound; m++) {
                    const pA1 = R[m];
                    const pA2 = R[N - 1 - m];
                    const pB1 = R[matchesPerRound + m];
                    const pB2 = R[N - 1 - matchesPerRound - m];

                    matches.push({
                        id: `m_americano_${genIdStr()}`,
                        tournamentId: tournament.id,
                        categoryId: autoConfig?.categoryId || undefined,
                        team1Id: `americano_temp_team_${matchCounter}_1`,
                        team2Id: `americano_temp_team_${matchCounter}_2`,
                        team1PlayerIds: [pA1.id, pA2.id],
                        team2PlayerIds: [pB1.id, pB2.id],
                        team1Name: `${pA1.name} & ${pA2.name}`,
                        team2Name: `${pB1.name} & ${pB2.name}`,
                        team1PlayerNames: '',
                        team2PlayerNames: '',
                        status: MatchStatus.SCHEDULED,
                        score: {
                            p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0,
                            p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [],
                            currentSet: 1, isTiebreak: false, history: []
                        },
                        court: '"TBD"',
                        scheduledTime: new Date(Date.now() + (r + 1) * 30 * 60 * 1000).toISOString(),
                        round: r + 1,
                        roundName: `Round ${r + 1}`,
                        stage: 'GROUP'
                    });
                    matchCounter++;
                }
            }
        } else {
            const players = teams.map(t => ({ id: t.id, name: t.name }));
            while (players.length % 4 !== 0) {
                players.push({ id: `BYE_${players.length}`, name: 'BYE' });
            }
            // MEXICANO - Round 1 only (random pairing)
            const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffledPlayers.length; i += 4) {
                const p1 = shuffledPlayers[i];
                const p2 = shuffledPlayers[i + 1];
                const p3 = shuffledPlayers[i + 2];
                const p4 = shuffledPlayers[i + 3];

                matches.push({
                    id: `m_mexicano_${genIdStr()}`,
                    tournamentId: tournament.id,
                    categoryId: autoConfig?.categoryId || undefined,
                    team1Id: `mexicano_temp_team_${matchCounter}_1`,
                    team2Id: `mexicano_temp_team_${matchCounter}_2`,
                    team1PlayerIds: [p1.id, p2.id].filter(id => !id.startsWith('BYE')),
                    team2PlayerIds: [p3.id, p4.id].filter(id => !id.startsWith('BYE')),
                    team1Name: [p1, p2].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
                    team2Name: [p3, p4].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
                    team1PlayerNames: '',
                    team2PlayerNames: '',
                    status: MatchStatus.SCHEDULED,
                    score: {
                        p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0,
                        p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [],
                        currentSet: 1, isTiebreak: false, history: []
                    },
                    court: '"TBD"',
                    scheduledTime: new Date().toISOString(),
                    round: 1,
                    roundName: `Round 1`,
                    stage: 'GROUP'
                });
                matchCounter++;
            }
        }
    }

    if (autoConfig && autoConfig.slots.length > 0) {
        const sortedMatches = matches.filter(m => (m.status !== MatchStatus.COMPLETED && String(m.status).toUpperCase() !== 'FINISHED'));
        // Sort by stage (GROUP first, then KNOCKOUT) and round
        const dependencySorted = sortedMatches.sort((a, b) => {
            if (a.stage !== b.stage) return a.stage === 'GROUP' ? -1 : 1;
            return a.round - b.round;
        });
        
        const courts = autoConfig.courts.length > 0 ? autoConfig.courts : (tournament.courts || ['Court 1']);
        
        // Track the next available timestamp for each court
        const courtAvailability: Record<string, number> = {};
        // Track when each individual team or player finishes their last match
        const entityLastUnlocked: Record<string, number> = {};

        // Helper to retrieve all locked entity IDs for a match
        const getEntitiesInMatch = (m: Match): string[] => {
            if (m.team1PlayerIds && m.team1PlayerIds.length > 0) {
                return [...m.team1PlayerIds, ...(m.team2PlayerIds || [])].filter(id => id && id !== 'BYE' && !id.startsWith('BYE'));
            }
            return [m.team1Id, m.team2Id].filter(id => id && id !== 'BYE' && id !== '') as string[];
        };

        let currentMatchIndex = 0;
        
        for (let currentSlotIndex = 0; currentSlotIndex < autoConfig.slots.length; currentSlotIndex++) {
            const slot = autoConfig.slots[currentSlotIndex];
            const slotStart = new Date(`${slot.date}T${slot.startTime}`).getTime();
            const slotEnd = new Date(`${slot.date}T${slot.endTime}`).getTime();
            
            // Align court availability to slotStart if they are back in history
            courts.forEach(c => {
                if (!courtAvailability[c] || courtAvailability[c] < slotStart) {
                    courtAvailability[c] = slotStart;
                }
            });

            const durationMs = (autoConfig.matchDuration + autoConfig.bufferTime) * 60000;
            let scheduledAnythingThisPass = true;

            while (scheduledAnythingThisPass && currentMatchIndex < dependencySorted.length) {
                let matchToSchedule: Match | null = null;
                let bestMatchIndexInSorted = -1;
                let bestCourt = '';
                let bestStartTime = Infinity;

                // Look ahead in the remaining matches to find one with no current team/player conflicts
                for (let i = currentMatchIndex; i < dependencySorted.length; i++) {
                    const candidateMatch = dependencySorted[i];
                    const entities = getEntitiesInMatch(candidateMatch);

                    // Check which courts can fit this match
                    for (const court of courts) {
                        const earliestCourtStart = courtAvailability[court];
                        
                        // Calculate when BOTH teams/players are completely free
                        let earliestEntityStart = slotStart;
                        entities.forEach(entityId => {
                            if (entityLastUnlocked[entityId] && entityLastUnlocked[entityId] > earliestEntityStart) {
                                earliestEntityStart = entityLastUnlocked[entityId];
                            }
                        });

                        const candidateStartTime = Math.max(earliestCourtStart, earliestEntityStart);
                        if (candidateStartTime + durationMs <= slotEnd) {
                            if (candidateStartTime < bestStartTime) {
                                bestStartTime = candidateStartTime;
                                bestCourt = court;
                                matchToSchedule = candidateMatch;
                                bestMatchIndexInSorted = i;
                            }
                        }
                    }
                }

                if (matchToSchedule && bestCourt !== '') {
                    // Schedule this match!
                    const finalStartTime = new Date(bestStartTime).toISOString();
                    matchToSchedule.scheduledTime = finalStartTime;
                    matchToSchedule.scheduledStartTime = finalStartTime;
                    matchToSchedule.court = bestCourt;
                    matchToSchedule.courtId = bestCourt;
                    matchToSchedule.scheduledCourtId = bestCourt;
                    matchToSchedule.actualCourtId = null;
                    matchToSchedule.courtOverrideBy = null;
                    matchToSchedule.courtOverrideAt = null;
                    matchToSchedule.conflictAcknowledged = null;

                    const endTime = bestStartTime + durationMs;
                    courtAvailability[bestCourt] = endTime;

                    // Lock the entities so they don't play overlap games
                    const entities = getEntitiesInMatch(matchToSchedule);
                    entities.forEach(id => {
                        entityLastUnlocked[id] = endTime;
                    });

                    // Remove from candidates list and increment our schedule counter
                    dependencySorted.splice(bestMatchIndexInSorted, 1);
                } else {
                    scheduledAnythingThisPass = false;
                }
            }
        }
    }

    return matches;
};

export const isMatchInCategory = (m: any, targetCategoryId: string | null | undefined, tournament?: any): boolean => {
    if (!targetCategoryId || targetCategoryId === 'ALL' || targetCategoryId === 'all') return true;
    if (!m) return false;
    
    if (m.categoryId === targetCategoryId) return true;
    
    const categories = tournament?.categories || [];
    const targetCatObj = categories.find((c: any) => c.id === targetCategoryId || c.name?.toLowerCase().trim() === String(targetCategoryId).toLowerCase().trim());
    const targetId = targetCatObj ? targetCatObj.id : targetCategoryId;
    const targetName = targetCatObj ? targetCatObj.name?.toLowerCase().trim() : String(targetCategoryId).toLowerCase().trim();

    const mCatId = m.categoryId === 'ALL' ? '' : (m.categoryId ? String(m.categoryId) : '');
    const mCatName = (m.categoryName === 'ALL' || m.category === 'ALL') ? '' : (m.categoryName ? String(m.categoryName).toLowerCase().trim() : (m.category ? String(m.category).toLowerCase().trim() : ''));

    if (mCatId && (mCatId === targetId || mCatId === targetCategoryId || mCatId.toLowerCase().trim() === targetName)) return true;
    if (mCatName && (mCatName === targetName || mCatName === targetId.toLowerCase().trim() || mCatName === String(targetCategoryId).toLowerCase().trim())) return true;
    
    // Fallback: single category tournament
    // Infer category from team if missing
    if (!mCatId && !mCatName && m.team1Id && tournament?.teams) {
        const t1 = tournament.teams.find((t: any) => t.id === m.team1Id);
        if (t1) {
            if (!t1.categoryId && !t1.categoryName && !t1.category) return true; // team has no category, show everywhere
            const inferredCatId = String(t1.categoryId || '');
            if (inferredCatId === targetId || inferredCatId === targetCategoryId || inferredCatId.toLowerCase().trim() === targetName) return true;
        }
    }
    
    if (!m.categoryId && !m.categoryName && !m.category && (!m.team1Id || m.team1Id === '')) {
        return true; // Show placeholder matches in all tabs so they aren't lost
    }
    if (categories.length === 1 && (!m.categoryId && !m.categoryName && !m.category)) {
        return true;
    }

    return false;
};

export const isTeamInCategory = (t: any, targetCategoryId: string | null | undefined, tournament?: any, matches?: Match[]): boolean => {
    if (!targetCategoryId || targetCategoryId === 'ALL' || targetCategoryId === 'all') return true;
    if (!t) return false;
    
    // Direct ID match
    if (t.categoryId === targetCategoryId) return true;
    
    // Check if targetCategoryId matches category ID or Name in tournament categories
    const categories = tournament?.categories || [];
    const targetCatObj = categories.find((c: any) => c.id === targetCategoryId || c.name?.toLowerCase().trim() === String(targetCategoryId).toLowerCase().trim());
    
    const targetId = targetCatObj ? targetCatObj.id : targetCategoryId;
    const targetName = targetCatObj ? targetCatObj.name?.toLowerCase().trim() : String(targetCategoryId).toLowerCase().trim();

    // Check team's categoryId, categoryName, or category field
    const teamCatId = t.categoryId ? String(t.categoryId) : '';
    const teamCatName = t.categoryName ? String(t.categoryName).toLowerCase().trim() : (t.category ? String(t.category).toLowerCase().trim() : '');

    if (teamCatId && (teamCatId === targetId || teamCatId === targetCategoryId || teamCatId.toLowerCase().trim() === targetName)) return true;
    if (teamCatName && (teamCatName === targetName || teamCatName === targetId.toLowerCase().trim() || teamCatName === String(targetCategoryId).toLowerCase().trim())) return true;
    if (targetName && (teamCatId.toLowerCase().trim() === targetName || teamCatName === targetName)) return true;

    // Check matches if provided or in tournament
    const matchesToSearch = matches || tournament?.matches;
    if (matchesToSearch && Array.isArray(matchesToSearch) && matchesToSearch.length > 0) {
        const playsInCategory = matchesToSearch.some((m: any) => {
            if (m.team1Id !== t.id && m.team2Id !== t.id) return false;
            return isMatchInCategory(m, targetCategoryId, tournament);
        });
        if (playsInCategory) return true;
    }

    // Fallback: If tournament only has 1 category and team has no category set, auto-associate
    if (categories.length === 1 && (!t.categoryId && !t.categoryName && !t.category)) {
        return true;
    }

    return false;
};

const teamsNeedUpdate = (current: Team[], computed: Team[]): boolean => {
    if (current.length !== computed.length) return true;
    for (let i = 0; i < current.length; i++) {
        const c = current[i];
        const comp = computed.find(t => t.id === c.id);
        if (!comp) return true;
        if (
            (c.matchesPlayed || 0) !== (comp.matchesPlayed || 0) ||
            (c.wins || 0) !== (comp.wins || 0) ||
            (c.losses || 0) !== (comp.losses || 0) ||
            (c.ties || 0) !== (comp.ties || 0) ||
            (c.points || 0) !== (comp.points || 0) ||
            (c.setsWon || 0) !== (comp.setsWon || 0) ||
            (c.setsLost || 0) !== (comp.setsLost || 0) ||
            (c.gamesWon || 0) !== (comp.gamesWon || 0) ||
            (c.gamesLost || 0) !== (comp.gamesLost || 0) ||
            (c.pointDifferential || 0) !== (comp.pointDifferential || 0) ||
            (c.gd || 0) !== (comp.gd || 0) ||
            (c.missedMatchPoints || 0) !== (comp.missedMatchPoints || 0) ||
            (comp.categoryId && c.categoryId !== comp.categoryId) ||
            (comp.categoryName && c.categoryName !== comp.categoryName)
        ) {
            return true;
        }
    }
    return false;
};

export const checkAndHealTournamentStats = async (tournament: Tournament, matches: Match[], targetCategoryId?: string | null, force: boolean = false) => {
    try {
        const tId = tournament.id;
        
        // Ensure we load ALL matches for the tournament from Firestore
        let allMatches = matches || [];
        const matchesCol = collection(db, "tournaments", tId, "matches");
        const matchesSnap = await getDocs(matchesCol);
        if (!matchesSnap.empty) {
            allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
        }

        if (!allMatches) allMatches = [];

        // Ensure we load ALL teams from the tournament document
        let teamsToUse = tournament.teams || [];
        const tRef = doc(db, "tournaments", tId);
        const tSnap = await getDoc(tRef);
        if (tSnap.exists()) {
            const freshT = tSnap.data() as Tournament;
            if (freshT.teams && freshT.teams.length > 0) {
                teamsToUse = freshT.teams;
            }
        }

        // If a specific category ID is requested for recalculation
        if (targetCategoryId && targetCategoryId !== 'ALL' && targetCategoryId !== 'all') {
            const categoryTeams = teamsToUse.filter(t => isTeamInCategory(t, targetCategoryId, tournament, allMatches));
            const categoryMatches = allMatches.filter(m => isMatchInCategory(m, targetCategoryId, tournament));
            const computedCategory = calculateStats(categoryTeams, categoryMatches, tournament.format, tournament.categories);

            if (force || teamsNeedUpdate(categoryTeams, computedCategory)) {
                // Merge computed category teams into teamsToUse without touching other categories
                const updatedTeams = teamsToUse.map(t => {
                    const comp = computedCategory.find(ct => ct.id === t.id);
                    return comp || t;
                });

                const statsBatch = writeBatch(db);
                statsBatch.update(tRef, cleanData({ teams: updatedTeams }));
                
                const standingsCol = collection(db, "tournaments", tId, "standings");
                computedCategory.forEach(tea => {
                    const sRef = doc(standingsCol, tea.id);
                    if (!tea.status || tea.status === 'ACCEPTED' || tea.status === 'APPROVED') {
                        statsBatch.set(sRef, cleanData(tea), { merge: true });
                    } else {
                        statsBatch.delete(sRef);
                    }
                });
                await statsBatch.commit();
                console.log(`Self-healed category stats for ${targetCategoryId} in tournament ${tId}`);
            }
        } else {
            // Recalculate each category independently to preserve category boundaries
            const categories = tournament.categories || [];
            let updatedTeams = [...teamsToUse];
            let anyUpdated = false;
            const statsBatch = writeBatch(db);
            const standingsCol = collection(db, "tournaments", tId, "standings");

            if (categories.length > 0) {
                for (const cat of categories) {
                    const catTeams = teamsToUse.filter(t => isTeamInCategory(t, cat.id, tournament, allMatches));
                    if (catTeams.length === 0) continue;
                    const catMatches = allMatches.filter(m => isMatchInCategory(m, cat.id, tournament));
                    const compCat = calculateStats(catTeams, catMatches, tournament.format, tournament.categories);
                    if (force || teamsNeedUpdate(catTeams, compCat)) {
                        anyUpdated = true;
                        compCat.forEach(tea => {
                            const idx = updatedTeams.findIndex(t => t.id === tea.id);
                            if (idx !== -1) updatedTeams[idx] = tea;
                            const sRef = doc(standingsCol, tea.id);
                            if (!tea.status || tea.status === 'ACCEPTED' || tea.status === 'APPROVED') {
                                statsBatch.set(sRef, cleanData(tea), { merge: true });
                            } else {
                                statsBatch.delete(sRef);
                            }
                        });
                    }
                }
            } else {
                const computed = calculateStats(teamsToUse, allMatches, tournament.format, tournament.categories);
                if (force || teamsNeedUpdate(teamsToUse, computed)) {
                    anyUpdated = true;
                    updatedTeams = computed;
                    computed.forEach(tea => {
                        const sRef = doc(standingsCol, tea.id);
                        if (!tea.status || tea.status === 'ACCEPTED' || tea.status === 'APPROVED') {
                            statsBatch.set(sRef, cleanData(tea), { merge: true });
                        } else {
                            statsBatch.delete(sRef);
                        }
                    });
                }
            }

            if (anyUpdated || force) {
                statsBatch.update(tRef, cleanData({ teams: updatedTeams }));
                await statsBatch.commit();
                console.log(`Self-healed all category stats for tournament ${tId}`);
            }
        }
    } catch (e) {
        console.error("Self-healing stats recalculation failed", e);
    }
};

export const calculateStats = (teams: Team[], matches: Match[], format: TournamentFormat, categories?: any[]): Team[] => {
    if (!teams) return [];
    
    // Create a map for easy lookup and to avoid mutating original teams
    const teamMap = new Map<string, Team>();
    teams.forEach(t => {
        let catId = t.categoryId;
        let catName = t.categoryName;
        if (!catId && matches && matches.length > 0) {
            const teamMatch = matches.find(m => (m.team1Id === t.id || m.team2Id === t.id) && m.categoryId);
            if (teamMatch) {
                catId = teamMatch.categoryId;
            }
        }
        if (categories && categories.length > 0) {
            const matchedCat = categories.find((c: any) => c.id === catId || c.name?.toLowerCase().trim() === String(catId || catName || '').toLowerCase().trim());
            if (matchedCat) {
                catId = matchedCat.id;
                catName = matchedCat.name;
            } else if (categories.length === 1 && !catId) {
                catId = categories[0].id;
                catName = categories[0].name;
            }
        }
        teamMap.set(t.id, {
            ...t,
            categoryId: catId,
            categoryName: catName,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            points: 0,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
            gamesPlayed: 0,
            pointsScored: 0,
            pointsConceded: 0,
            pointDifferential: 0,
            missedMatchPoints: 0,
            gd: 0,
            knockoutStage: '',
            knockoutWeight: 0,
            fipPpfPoints: 0
        });
    });

    // Helper to set knockout rank weight for a team
    const setTeamKnockoutRank = (tId: string | undefined, stage: string, weight: number) => {
        if (!tId) return;
        const t = teamMap.get(tId);
        if (!t) return;
        // Keep highest weight achieved
        if ((t.knockoutWeight || 0) < weight) {
            t.knockoutStage = stage;
            t.knockoutWeight = weight;
        }
    };

    matches.forEach(m => {
        if (!m) return;
        const statusUpper = String(m.status || '').toUpperCase();
        if (statusUpper !== 'COMPLETED' && statusUpper !== 'FINISHED') return;

        const mScore = (m.score || {}) as any;
        
        let p1Games = 0;
        let p2Games = 0;
        let p1Sets = 0;
        let p2Sets = 0;

        if (Array.isArray(mScore)) {
            // Legacy array format: [{team1: 6, team2: 4}, ...]
            mScore.forEach((s: any) => {
                const g1 = parseInt(s.team1) || 0;
                const g2 = parseInt(s.team2) || 0;
                p1Games += g1;
                p2Games += g2;
                if (g1 > g2) p1Sets++;
                else if (g2 > g1) p2Sets++;
            });
        } else if (mScore.sets && Array.isArray(mScore.sets)) {
            mScore.sets.forEach((s: any) => {
                const g1 = parseInt(s.team1) || 0;
                const g2 = parseInt(s.team2) || 0;
                p1Games += g1;
                p2Games += g2;
                if (g1 > g2) p1Sets++;
                else if (g2 > g1) p2Sets++;
            });
        } else if (mScore.p1SetScores && Array.isArray(mScore.p1SetScores) && mScore.p1SetScores.length > 0) {
            const p1SetScores: number[] = mScore.p1SetScores;
            const p2SetScores: number[] = mScore.p2SetScores || [];
            p1Games = p1SetScores.reduce((a, b) => a + (Number(b) || 0), 0);
            p2Games = p2SetScores.reduce((a, b) => a + (Number(b) || 0), 0);
            
            p1SetScores.forEach((s: number, i: number) => {
                const os = p2SetScores[i] || 0;
                if (s > os) p1Sets++;
                else if (os > s) p2Sets++;
            });
        } else {
            p1Games = Number(mScore.p1Games) || 0;
            p2Games = Number(mScore.p2Games) || 0;
            p1Sets = Number(mScore.p1Sets) || 0;
            p2Sets = Number(mScore.p2Sets) || 0;
        }

        const isAmericano = format === TournamentFormat.AMERICANO || format === TournamentFormat.MEXICANO || (format as string) === 'AMERICANO' || (format as string) === 'MEXICANO';

        if (isAmericano) {
            const t1Ids = m.team1PlayerIds || (m.team1Id ? [m.team1Id] : []);
            const t2Ids = m.team2PlayerIds || (m.team2Id ? [m.team2Id] : []);

            let isT1Winner = m.winnerTeamId === m.team1Id;
            let isT2Winner = m.winnerTeamId === m.team2Id;

            if (p1Games > p2Games) {
                isT1Winner = true;
                isT2Winner = false;
            } else if (p2Games > p1Games) {
                isT1Winner = false;
                isT2Winner = true;
            } else if (!m.winnerTeamId) {
                isT1Winner = false;
                isT2Winner = false;
            }

            t1Ids.forEach(id => {
                const t = teamMap.get(id);
                if (!t) return;
                t.matchesPlayed = (t.matchesPlayed || 0) + 1;
                t.gamesWon = (t.gamesWon || 0) + p1Games;
                t.gamesLost = (t.gamesLost || 0) + p2Games;
                t.gamesPlayed = (t.gamesPlayed || 0) + p1Games + p2Games;
                t.pointsScored = (t.pointsScored || 0) + p1Games;
                t.pointsConceded = (t.pointsConceded || 0) + p2Games;
                t.pointDifferential = (t.pointDifferential || 0) + (p1Games - p2Games);
                t.gd = (t.gamesWon || 0) - (t.gamesLost || 0);

                if (isT1Winner) {
                    t.wins = (t.wins || 0) + 1;
                } else if (isT2Winner) {
                    t.losses = (t.losses || 0) + 1;
                } else {
                    t.ties = (t.ties || 0) + 1;
                }
                t.points = (t.points || 0) + p1Games;
            });

            t2Ids.forEach(id => {
                const t = teamMap.get(id);
                if (!t) return;
                t.matchesPlayed = (t.matchesPlayed || 0) + 1;
                t.gamesWon = (t.gamesWon || 0) + p2Games;
                t.gamesLost = (t.gamesLost || 0) + p1Games;
                t.gamesPlayed = (t.gamesPlayed || 0) + p2Games + p1Games;
                t.pointsScored = (t.pointsScored || 0) + p2Games;
                t.pointsConceded = (t.pointsConceded || 0) + p1Games;
                t.pointDifferential = (t.pointDifferential || 0) + (p2Games - p1Games);
                t.gd = (t.gamesWon || 0) - (t.gamesLost || 0);

                if (isT2Winner) {
                    t.wins = (t.wins || 0) + 1;
                } else if (isT1Winner) {
                    t.losses = (t.losses || 0) + 1;
                } else {
                    t.ties = (t.ties || 0) + 1;
                }
                t.points = (t.points || 0) + p2Games;
            });
        } else {
            let isT1Winner = m.winnerTeamId === m.team1Id;
            let isT2Winner = m.winnerTeamId === m.team2Id;

            if (!m.winnerTeamId) {
                if (p1Sets > p2Sets) {
                    isT1Winner = true;
                    isT2Winner = false;
                } else if (p2Sets > p1Sets) {
                    isT1Winner = false;
                    isT2Winner = true;
                } else if (p1Games > p2Games) {
                    isT1Winner = true;
                    isT2Winner = false;
                } else if (p2Games > p1Games) {
                    isT1Winner = false;
                    isT2Winner = true;
                }
            }

            const isTie = !isT1Winner && !isT2Winner && (p1Sets === p2Sets && p1Games === p2Games);

            const processTeamStats = (tId: string | undefined, tIsWinner: boolean, tIsLoser: boolean, setsWon: number, setsLost: number, gamesWon: number, gamesLost: number, pointsToAdd: number) => {
                const t = teamMap.get(tId);
                if (!t) return;
                t.matchesPlayed = (t.matchesPlayed || 0) + 1;
                t.setsWon = (t.setsWon || 0) + setsWon;
                t.setsLost = (t.setsLost || 0) + setsLost;
                t.gamesWon = (t.gamesWon || 0) + gamesWon;
                t.gamesLost = (t.gamesLost || 0) + gamesLost;
                t.gamesPlayed = (t.gamesPlayed || 0) + gamesWon + gamesLost;
                t.pointsScored = (t.pointsScored || 0) + gamesWon;
                t.pointsConceded = (t.pointsConceded || 0) + gamesLost;
                t.pointDifferential = (t.pointDifferential || 0) + (gamesWon - gamesLost);
                t.gd = (t.gamesWon || 0) - (t.gamesLost || 0);

                if (tIsWinner) {
                    t.wins = (t.wins || 0) + 1;
                } else if (tIsLoser) {
                    t.losses = (t.losses || 0) + 1;
                } else {
                    t.ties = (t.ties || 0) + 1;
                }

                t.points = (t.points || 0) + pointsToAdd;
            };

            const t1Points = isT1Winner ? 2 : (isTie ? 1 : 0);
            const t2Points = isT2Winner ? 2 : (isTie ? 1 : 0);

            processTeamStats(m.team1Id, isT1Winner, isT2Winner, p1Sets, p2Sets, p1Games, p2Games, t1Points);
            processTeamStats(m.team2Id, isT2Winner, isT1Winner, p2Sets, p1Sets, p2Games, p1Games, t2Points);

            // Detect Knockout round outcomes for priority rank & FIP/PPF points
            const roundStr = String(m.round || m.roundName || m.stage || '').toUpperCase();
            const isFinalMatch = (roundStr.includes('FINAL') || roundStr === 'F') && !roundStr.includes('SEMI') && !roundStr.includes('QUARTER') && !roundStr.includes('1/4') && !roundStr.includes('1/2');
            const isSemiMatch = roundStr.includes('SEMI') || roundStr.includes('1/2') || roundStr === 'SF';
            const isQuarterMatch = roundStr.includes('QUARTER') || roundStr.includes('1/4') || roundStr === 'QF';

            if (isFinalMatch) {
                if (isT1Winner) {
                    setTeamKnockoutRank(m.team1Id, 'CHAMPION', 100000);
                    setTeamKnockoutRank(m.team2Id, 'RUNNER_UP', 50000);
                } else if (isT2Winner) {
                    setTeamKnockoutRank(m.team2Id, 'CHAMPION', 100000);
                    setTeamKnockoutRank(m.team1Id, 'RUNNER_UP', 50000);
                }
            } else if (isSemiMatch) {
                if (isT1Winner) {
                    setTeamKnockoutRank(m.team2Id, 'SEMI_FINALIST', 25000);
                } else if (isT2Winner) {
                    setTeamKnockoutRank(m.team1Id, 'SEMI_FINALIST', 25000);
                }
            } else if (isQuarterMatch) {
                if (isT1Winner) {
                    setTeamKnockoutRank(m.team2Id, 'QUARTER_FINALIST', 12000);
                } else if (isT2Winner) {
                    setTeamKnockoutRank(m.team1Id, 'QUARTER_FINALIST', 12000);
                }
            }
        }
    });

    const calculatedTeams = Array.from(teamMap.values());
    
    // For Americano/Mexicano, calculate missed matches compensation (M+) after processing all matches
    if (format === TournamentFormat.AMERICANO || format === TournamentFormat.MEXICANO || (format as string) === 'AMERICANO' || (format as string) === 'MEXICANO') {
        const maxMatchesPlayed = Math.max(...calculatedTeams.map(t => t.matchesPlayed || 0), 0);
        calculatedTeams.forEach(t => {
            const mp = t.matchesPlayed || 0;
            if (maxMatchesPlayed > 0 && mp < maxMatchesPlayed) {
                const missedCount = maxMatchesPlayed - mp;
                let avgPoints = 8;
                if (mp > 0) {
                    avgPoints = Math.round((t.pointsScored || 0) / mp);
                }
                t.missedMatchPoints = missedCount * avgPoints;
            } else {
                t.missedMatchPoints = 0;
            }
            t.points = (t.pointsScored || 0) + (t.missedMatchPoints || 0);
        });
    }

    // Calculate FIP / PPF Points table values
    calculatedTeams.forEach(t => {
        t.gd = (t.gamesWon || 0) - (t.gamesLost || 0);
        if (t.pointDifferential === undefined) {
            t.pointDifferential = t.gd;
        }

        let fipPts = 0;
        if (t.knockoutStage === 'CHAMPION') fipPts = 1000;
        else if (t.knockoutStage === 'RUNNER_UP') fipPts = 600;
        else if (t.knockoutStage === 'SEMI_FINALIST') fipPts = 300;
        else if (t.knockoutStage === 'QUARTER_FINALIST') fipPts = 150;
        else fipPts = 50;

        fipPts += (t.wins || 0) * 50;
        t.fipPpfPoints = fipPts;
    });

    // Sort by official Padel standings rules: Knockout Weight (Finals Winner #1) > FIP/PPF Points > Standings Points > Wins > Sets Diff > Games/Point Diff > Games Won > Name
    calculatedTeams.sort((a, b) => {
        const kwA = a.knockoutWeight || 0;
        const kwB = b.knockoutWeight || 0;
        if (kwB !== kwA) return kwB - kwA;

        const fipA = a.fipPpfPoints || 0;
        const fipB = b.fipPpfPoints || 0;
        if (fipB !== fipA) return fipB - fipA;

        if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        const aSetDiff = (a.setsWon || 0) - (a.setsLost || 0);
        const bSetDiff = (b.setsWon || 0) - (b.setsLost || 0);
        if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
        
        const aDiff = a.pointDifferential !== undefined ? a.pointDifferential : (a.gd || 0);
        const bDiff = b.pointDifferential !== undefined ? b.pointDifferential : (b.gd || 0);
        if (bDiff !== aDiff) return bDiff - aDiff;

        const aWon = a.gamesWon || a.pointsScored || 0;
        const bWon = b.gamesWon || b.pointsScored || 0;
        if (bWon !== aWon) return bWon - aWon;

        return (a.name || '').localeCompare(b.name || '');
    });

    return calculatedTeams;
};

export const generateSchedule = async (tId: string, knockoutConfig?: any[], autoConfig?: AutoScheduleConfig) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            const matches = calculateSchedule(tData, knockoutConfig, autoConfig);
            
            const batch = writeBatch(db);
            const matchesCol = collection(db, "tournaments", tId, "matches");
            
            const existing = await getDocs(matchesCol);
            
            let matchesToDelete = existing.docs;
            if (autoConfig?.categoryId) {
                matchesToDelete = existing.docs.filter(d => {
                    const data = d.data();
                    return data.categoryId === autoConfig.categoryId;
                });
            }

            matchesToDelete.forEach(d => {
                const data = d.data();
                const isFinished = data.status === MatchStatus.COMPLETED || String(data.status).toUpperCase() === 'FINISHED';

                batch.delete(d.ref)
                const globalMatchRef = doc(db, "matches", d.id);
                batch.delete(globalMatchRef);
            });

            matches.forEach(m => {
                const mRef = doc(matchesCol, m.id);
                const globalMatchRef = doc(db, "matches", m.id);
                batch.set(mRef, cleanData(m));
                batch.set(globalMatchRef, cleanData({
                    ...m,
                    tournamentId: tId // Ensure this is present
                }));
            });
            
            // Calculate starting standings (all 0) and overwrite the standings collection
            const standingsCol = collection(db, "tournaments", tId, "standings");
            const existingStandings = await getDocs(standingsCol);
            
            let standingsToDelete = existingStandings.docs;
            if (autoConfig?.categoryId) {
                standingsToDelete = existingStandings.docs.filter(d => {
                    const data = d.data();
                    return data.categoryId === autoConfig.categoryId;
                });
            }
            standingsToDelete.forEach(d => batch.delete(d.ref));
            
            // Filter to only accepted teams for this category
            let teamsForStandings = tData.teams?.filter(t => t.status === 'ACCEPTED') || [];
            if (autoConfig?.categoryId) {
                 teamsForStandings = teamsForStandings.filter(t => t.categoryId === autoConfig.categoryId);
            }
            
            const preservedMatches = existing.docs
                .map(d => ({ id: d.id, ...d.data() } as Match))
                .filter(m => (m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED') && (!autoConfig?.categoryId || m.categoryId === autoConfig.categoryId));

            const initialStandings = calculateStats(teamsForStandings, preservedMatches, tData.format, tData.categories || []);
            initialStandings.forEach(team => {
                const sRef = doc(standingsCol, team.id);
                batch.set(sRef, cleanData(team));
            });

            await batch.commit();
            await updateDoc(tRef, { matches: [] }); // Clear array so that subs are used
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.matches = calculateSchedule(t, knockoutConfig, autoConfig);
            notifyMock();
        }
    }
};


export const appendNewMexicanoRound = async (tId: string) => {
    const tRef = doc(db, "tournaments", tId);
    const snap = await getDoc(tRef);
    
    const tData = snap.data() as Tournament;

    const matchesCol = collection(db, "tournaments", tId, "matches");
    const existing = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));
    const currentMatches = existing.docs.map(d => d.data() as Match);

    const maxRound = currentMatches.reduce((max, m) => Math.max(max, m.round || 1), 0);
    const nextRound = maxRound + 1;

    let teams = tData.teams?.filter(t => t.status === 'ACCEPTED') || [];

    let players = teams.map(t => ({ id: t.id, name: t.name, points: t.points || 0, gd: (t.gamesWon || 0) - (t.gamesLost || 0), gamesWon: t.gamesWon || 0 }));
    players.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gamesWon - a.gamesWon;
    });

    while (players.length % 4 !== 0) {
        players.push({ id: `BYE_${players.length}`, name: 'BYE', points: -999, gd: -999, gamesWon: 0 });
    }

    const genIdStr = () => Math.random().toString(36).substr(2, 9);
    const batch = writeBatch(db);
    let matchCounter = 1;

    for (let i = 0; i < players.length; i += 4) {
        const p1 = players[i];
        const p2 = players[i + 1];
        const p3 = players[i + 2];
        const p4 = players[i + 3];

        const matchId = `m_mexicano_r${nextRound}_${genIdStr()}`;
        const newMatch: Match = {
            id: matchId,
            tournamentId: tId,
            team1Id: `mexicano_temp_team_r${nextRound}_${matchCounter}_1`,
            team2Id: `mexicano_temp_team_r${nextRound}_${matchCounter}_2`,
            team1PlayerIds: [p1.id, p3.id].filter(id => !id.startsWith('BYE')),
            team2PlayerIds: [p2.id, p4.id].filter(id => !id.startsWith('BYE')),
            team1Name: [p1, p3].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
            team2Name: [p2, p4].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
            status: MatchStatus.SCHEDULED,
            score: {
                p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0,
                p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [],
                currentSet: 1, isTiebreak: false, history: []
            },
            court: '"TBD"',
            scheduledTime: new Date().toISOString(),
            round: nextRound,
            roundName: `Round ${nextRound}`,
            stage: 'GROUP' // Treated as group stage points
        };

        const mRef = doc(matchesCol, matchId);
        const globalMatchRef = doc(db, "matches", matchId);
        batch.set(mRef, cleanData(newMatch));
        batch.set(globalMatchRef, cleanData({ ...newMatch, tournamentId: tId }));
        matchCounter++;
    }

    await batch.commit();
};

export const updateMatchDetails = async (tId: any, mId: any, updates: any, ...args: any[]) => {
    if (updates.status === MatchStatus.COMPLETED && updates.winnerTeamId && db) {
        (async () => {
            try {
                const matchesSnap = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));
                let allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
                const matchIdx = allMatches.findIndex(m => m.id === mId);
                if (matchIdx !== -1) {
                    allMatches[matchIdx] = { ...allMatches[matchIdx], ...updates };
                    const match = allMatches[matchIdx];
                    // Sync history for players
                    if (updates.status === MatchStatus.COMPLETED) {
                        const tSnap = await getDoc(doc(db, "tournaments", tId));
                        if (tSnap.exists()) {
                            syncPlayerMatchToHistory(match, tSnap.data() as Tournament).catch(console.error);
                        }
                    }
                    const winnerName = (match.team1Id === updates.winnerTeamId) ? match.team1Name : (match.team2Id === updates.winnerTeamId ? match.team2Name : "TBD");
                    const updatedMatches = advanceBracket(allMatches, match, updates.winnerTeamId, winnerName || "TBD");
                    const batch = writeBatch(db);
                    updatedMatches.forEach(m => {
                        if (m.id !== mId) {
                            const mRef = doc(db, "tournaments", tId, "matches", m.id);
                            batch.set(mRef, cleanData(m), { merge: true });
                        }
                    });
                    await batch.commit();

                    await runTransaction(db, async (transaction) => {
                        const tRefStats = doc(db, "tournaments", tId);
                        const tSnapStats = await transaction.get(tRefStats);
                        if (tSnapStats.exists()) {
                            const t = tSnapStats.data() as Tournament;
                            const updatedTeams = calculateStats(t.teams, updatedMatches, t.format, t.categories || []);
                            transaction.update(tRefStats, cleanData({ teams: updatedTeams }));
                            const standingsCol = collection(db, "tournaments", tId, "standings");
                            updatedTeams.forEach(tea => { 
                                transaction.set(doc(standingsCol, tea.id), cleanData(tea), { merge: true }); 
                            });
                        }
                    });
                }
            } catch (e) {
                console.error("Bracket advancement failed in updateMatchDetails", e);
            }
        })();
    }
    if (db) {
        // Update specific match doc in subcollection
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        const globalMatchRef = doc(db, "matches", mId);
        
        try {
           const batch = writeBatch(db);
           batch.set(mRef, cleanData(updates), { merge: true });
           batch.set(globalMatchRef, cleanData({ ...updates, tournamentId: tId, id: mId }), { merge: true });
           await batch.commit();
        } catch(e) {
           // Fallback if the global match document doesn't exist for some reason
           await setDoc(mRef, cleanData(updates), { merge: true });
           await setDoc(globalMatchRef, cleanData({ ...updates, tournamentId: tId, id: mId }), { merge: true });
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.matches = t.matches.map(m => m.id === mId ? { ...m, ...updates } : m);
            notifyMock();
        }
    }
};

export const submitScoreChangeRequest = async (tournamentId: string, request: any) => {
  const reqRef = doc(collection(db, 'scoreChangeRequests'));
  await setDoc(reqRef, {
      ...request,
      tournamentId,
      status: 'pending',
      createdAt: new Date().toISOString()
  });
};

export const subscribeToScoreChangeRequests = (venueIdOrTournamentId: string, callback: (data: any[]) => void) => {
  if (!db) return () => {};
  // For now we'll just fetch all or filter by tournamentId since venue connection might need more work,
  // Let's filter by status pending/approved/rejected, and tournamentId
  // Wait, if it's venue dashboard it might need to get tournaments for that venue
  // For simplicity since DB structure is flat:
  const q = query(collection(db, 'scoreChangeRequests'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(results);
  });
};

export const updateMatchScore = async (tId: string, mId: string, newScore: ScoreState, status: MatchStatus, winnerId?: string) => {
    // We will sync history inside the completion block
    if (db) {
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        const globalMatchRef = doc(db, "matches", mId);
        
        const updatePayload: any = cleanData({ 
             score: newScore, 
             status, 
             winnerTeamId: winnerId
        });
        if (status !== MatchStatus.COMPLETED && String(status).toUpperCase() !== "FINISHED" && String(status).toUpperCase() !== "COMPLETED") {
            updatePayload.activeBroadcastEvent = {
                id: genId(),
                type: 'SCORE_UPDATE',
                timestamp: Date.now(),
                duration: 3000
            };
        }
        
        // 1. Update the match score directly (Fast)
        try {
           const batch = writeBatch(db);
           const obsIndexRef = doc(db, "obsIndex", mId);
           batch.set(mRef, updatePayload, { merge: true });
           batch.set(globalMatchRef, { ...updatePayload, tournamentId: tId, id: mId }, { merge: true });
           batch.set(obsIndexRef, { tournamentId: tId, matchId: mId, timestamp: new Date().toISOString() }, { merge: true });
           await batch.commit();

           // Trigger auto-heal of tournament stats in background
           (async () => {
               try {
                   const tRef = doc(db, "tournaments", tId);
                   const tSnap = await getDoc(tRef);
                   if (tSnap.exists()) {
                       const tournament = tSnap.data() as Tournament;
                       await checkAndHealTournamentStats(tournament, [], null, true);
                   }
               } catch (err) {
                   console.error("Auto-heal failed after updateMatchScore", err);
               }
           })();
        } catch(e) {
           console.error("Score update failed", e);
        }

        // Bracket advancement is now handled in updateMatchDetails to avoid duplicate writes and quota errors.
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            let updatedMatches = t.matches.map(m => {
                if (m.id === mId) return { ...m, score: newScore, status, winnerTeamId: winnerId };
                return m;
            });
            const match = updatedMatches.find(m => m.id === mId);
            if (status === MatchStatus.COMPLETED && winnerId && match) {
                const winnerName = winnerId === match.team1Id ? match.team1Name : (winnerId === match.team2Id ? match.team2Name : "TBD");
                updatedMatches = advanceBracket(updatedMatches, match, winnerId, winnerName || "TBD");
            }
            const updatedTeams = calculateStats(t.teams, updatedMatches, t.format, t.categories || []);
            t.matches = updatedMatches;
            t.teams = updatedTeams;
            notifyMock();
        }
    }
};

export const syncStandalonePlayersToGlobal = async () => {
    if (db) {
        try {
            const playersSnap = await getDocs(collection(db, "players"));
            let batch = writeBatch(db);
            let batchCount = 0;

            for (const docSnap of playersSnap.docs) {
                const p = docSnap.data() as any;
                if (!p || !p.name) continue;

                const normalizeName = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, '_');
                const normalizeEmail = (e: string) => (e || '').toLowerCase().trim().replace(/[@.]/g, '_');
                const normalizePhone = (ph: string) => (ph || '').replace(/[^0-9]/g, '');

                const playerKey = [
                    normalizeName(p.name),
                    normalizeEmail(p.email || ''),
                    normalizePhone(p.phone || '')
                ].filter(Boolean).join('__');

                if (!playerKey) continue;

                const playerRef = doc(db, "onboardedPlayers", playerKey);
                
                const playerPayload: Partial<OnboardedPlayer> = {
                    id: playerKey,
                    name: p.name,
                    email: p.email || '',
                    phone: p.phone || '',
                    cnic: p.cnic || '',
                    photoUrl: p.photoUrl || '',
                    verified: p.verified || false,
                    lastUpdated: new Date().toISOString()
                };

                batch.set(playerRef, cleanData(playerPayload), { merge: true });
                batchCount++;

                if (batchCount === 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }
            console.log("Successfully synchronized standalone players to global collections.");
        } catch (e: any) {
            console.error("Failed to sync standalone players", e);
        }
    }
};

export const syncAllDataToGlobal = async () => {
    if (db) {
        try {
            console.log("Starting full global sync...");
            await syncStandalonePlayersToGlobal();
            const toursSnap = await getDocs(collection(db, "tournaments"));
            for (const docSnap of toursSnap.docs) {
                await syncTournamentPlayersAndTeams(docSnap.id);
            }
            console.log("Successfully synchronized all data to global collections.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.LIST, "syncAllDataToGlobal");
        }
    } else {
        mockTournaments.forEach(t => {
            syncTournamentPlayersAndTeams(t.id);
        });
    }
};

export const subscribeToStandings = (tournamentId: any, categoryId: any, callback: any, tournament?: any) => {
    if (!db) return () => {};
    const q = collection(db, "tournaments", tournamentId, "standings");
    return onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (categoryId && categoryId !== 'ALL' && categoryId !== 'all') {
            const filtered = results.filter(t => isTeamInCategory(t, categoryId, tournament));
            callback(filtered);
        } else {
            callback(results);
        }
    });
};

export const deleteKnockoutMatchCascade = async (tId: any, mId: any, ...args: any[]) => {
    if (db) {
        await deleteDoc(doc(db, "tournaments", tId, "matches", mId));
        await deleteDoc(doc(db, "matches", mId));
    }
};

export const recalculateMatchResult = async (tId: string, mId: string, sets: any[], adminId: string, adminEmail: string) => {
    if (db) {
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        const globalMatchRef = doc(db, "matches", mId);
        
        const p1SetScores = sets.map(s => s.team1);
        const p2SetScores = sets.map(s => s.team2);
        const p1Sets = sets.filter(s => s.team1 > s.team2).length;
        const p2Sets = sets.filter(s => s.team2 > s.team1).length;
        
        let winnerId = '';
        if (p1Sets > p2Sets) {
            const snap = await getDoc(mRef);
            winnerId = snap.exists() ? snap.data().team1Id : '';
        } else if (p2Sets > p1Sets) {
            const snap = await getDoc(mRef);
            winnerId = snap.exists() ? snap.data().team2Id : '';
        }

        const p1Games = p1SetScores.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
        const p2Games = p2SetScores.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);

        const newScore: ScoreState = {
            p1Points: '0',
            p2Points: '0',
            p1Games,
            p2Games,
            p1Sets,
            p2Sets,
            p1SetScores,
            p2SetScores,
            currentSet: sets.length,
            isTiebreak: false,
            history: [],
            
        };

        const updatePayload = cleanData({ 
            score: newScore, 
            winnerTeamId: winnerId || null,
            lastModifiedBy: adminEmail,
            status: MatchStatus.COMPLETED
        });

        await updateDoc(mRef, updatePayload);
        try {
            await updateDoc(globalMatchRef, updatePayload);
        } catch (e) {
            // might not exist globally
        }

        // Trigger stats recalculation and bracket advancement
        try {
            const matchesSnap = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));
            let allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
            
            const currentMatch = allMatches.find(m => m.id === mId);
            if (currentMatch) {
                currentMatch.score = newScore;
                currentMatch.status = MatchStatus.COMPLETED;
                currentMatch.winnerTeamId = winnerId;
                
                const tRef = doc(db, "tournaments", tId);
                const tSnap = await getDoc(tRef);
                const t = tSnap.data() as Tournament;
                
                const winnerTeam = (t.teams || []).find((tea: any) => tea.id === winnerId);
                const winnerName = winnerTeam?.name || (winnerId === currentMatch.team1Id ? currentMatch.team1Name : currentMatch.team2Name) || 'Winner';
                
                const updatedMatches = advanceBracket(allMatches, currentMatch, winnerId, winnerName);
                
                // Update matches that were changed by advanceBracket
                const mBatch = writeBatch(db);
                updatedMatches.forEach(m => {
                    if (m.id !== mId) {
                        mBatch.set(doc(db, "tournaments", tId, "matches", m.id), cleanData(m), { merge: true });
                    }
                });
                await mBatch.commit();

                // Atomically update standings and tournament doc
                await runTransaction(db, async (transaction) => {
                    const tRefStats = doc(db, "tournaments", tId);
                    const tSnapStats = await transaction.get(tRefStats);
                    if (tSnapStats.exists()) {
                        const tData = tSnapStats.data() as Tournament;
                        const updatedTeams = calculateStats(tData.teams, updatedMatches, tData.format, tData.categories || []);
                        transaction.update(tRefStats, cleanData({ teams: updatedTeams }));
                        
                        const standingsCol = collection(db, "tournaments", tId, "standings");
                        updatedTeams.forEach(tea => {
                            const sRef = doc(standingsCol, tea.id);
                            if (tea.status === 'ACCEPTED') {
                                transaction.set(sRef, cleanData(tea));
                            } else {
                                transaction.delete(sRef);
                            }
                        });
                    }
                });
            }
        } catch (err) {
            console.error("Standings update failed after score correction", err);
        }
    }
};

export const getAllRegisteredPlayers = async () => {
    if (!db) return [];
    const snap = await getDocs(collection(db, "players"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const mergePlayerProfiles = async (sourceId: string, targetId: string) => {
    console.log('Merging profiles', sourceId, targetId);
};


export const addKnockoutMatch = async (...args: any[]) => {
    const [tId, categoryId, roundName, team1Id, team2Id, scheduledTime, court] = args;
    if (db) {
        const payload = {
            id: 'm_' + Date.now() + Math.random().toString(36).substr(2, 9),
            categoryId,
            categoryName: categoryId === 'ALL' ? 'ALL' : undefined,
            roundName,
            team1Id,
            team2Id,
            scheduledTime: scheduledTime || null,
            scheduledCourtId: court ? court.id : null,
            scheduledCourtName: court ? court.name : null,
            status: "SCHEDULED",
            stage: "KNOCKOUT"
        };
        const batch = writeBatch(db);
        batch.set(doc(db, "tournaments", tId, "matches", payload.id), cleanData(payload));
        batch.set(doc(db, "matches", payload.id), cleanData({ ...payload, tournamentId: tId, id: payload.id }));
        await batch.commit();
    }
};
export const deleteMatch = async (tId: string, mId: string) => {
    if(db) {
        const batch = writeBatch(db);
        batch.delete(doc(db, "tournaments", tId, "matches", mId));
        batch.delete(doc(db, "matches", mId));
        await batch.commit();

        try {
            const tRef = doc(db, "tournaments", tId);
            const tSnap = await getDoc(tRef);
            if (tSnap.exists()) {
                const tournament = tSnap.data() as Tournament;
                await checkAndHealTournamentStats(tournament, [], null, true);
            }
        } catch (err) {
            console.error("Auto-heal failed after deleteMatch", err);
        }
    }
};
export const replaceTeamInTournament = async (tId: any, oldTeamId: any, newTeam: any, ...args: any[]) => {
    console.log('Replacing', oldTeamId, 'with', newTeam);
};
export const editTeamInTournament = async (tId: string, teamId: string, name: string, player1Name: string, player2Name: string) => {
    if (db) {
        try {
            await runTransaction(db, async (transaction) => {
                const tRef = doc(db, "tournaments", tId);
                const tSnap = await transaction.get(tRef);
                
                if (tSnap.exists()) {
                    const t = tSnap.data() as Tournament;
                    const isAmericanoMode = t.format === 'AMERICANO' || t.format === 'MEXICANO';
                    const updatedTeams = t.teams.map(team => {
                        if (team.id === teamId) {
                            const updated = JSON.parse(JSON.stringify(team));
                            updated.name = name;
                            
                            if (!updated.player1) updated.player1 = { id: genId(), name: '' };
                            updated.player1.name = player1Name;
                            
                            if (!isAmericanoMode) {
                                if (!updated.player2) updated.player2 = { id: genId(), name: '' };
                                if (player2Name !== undefined) updated.player2.name = player2Name;
                            }
                            return updated;
                        }
                        return team;
                    });
                    
                    transaction.update(tRef, cleanData({ teams: updatedTeams }));

                    const formatPlayerNames = (p1?: string, p2?: string) => {
                        if (isAmericanoMode) return p1 || '';
                        return [p1, p2].filter(Boolean).join(' & ');
                    };

                    // Update match stubs within the tournament
                    const matchesRef = query(collection(db, "matches"), where("tournamentId", "==", tId));
                    const matchesSnap = await getDocs(matchesRef);
                    matchesSnap.docs.forEach(d => {
                        const m = d.data();
                        let needsUpdate = false;
                        const updatePayload: any = {};
                        if (m.team1Id === teamId) {
                            updatePayload.team1Name = name;
                            updatePayload.team1PlayerNames = formatPlayerNames(player1Name, player2Name);
                            needsUpdate = true;
                        }
                        if (m.team2Id === teamId) {
                            updatePayload.team2Name = name;
                            updatePayload.team2PlayerNames = formatPlayerNames(player1Name, player2Name);
                            needsUpdate = true;
                        }
                        if (needsUpdate) {
                            transaction.update(d.ref, updatePayload);
                        }
                    });
                    
                    // Update standings subcollection too
                    const sRef = doc(db, "tournaments", tId, "standings", teamId);
                    const currentTeam = updatedTeams.find(x => x.id === teamId);
                    if (currentTeam) {
                        transaction.set(sRef, cleanData(currentTeam), { merge: true });
                    }
                }
            });
            
            // Handle global matches separately
            const tRef = doc(db, "tournaments", tId);
            const tSnap = await getDoc(tRef);
            if (tSnap.exists()) {
                const matchesRef = query(collection(db, "matches"), where("tournamentId", "==", tId));
                const matchesSnap = await getDocs(matchesRef);
                const batch = writeBatch(db);
                const t = tSnap.data() as Tournament;
                const isAmericanoMode = t.format === 'AMERICANO' || t.format === 'MEXICANO';
                const formatPlayerNames = (p1?: string, p2?: string) => {
                    if (isAmericanoMode) return p1 || '';
                    return [p1, p2].filter(Boolean).join(' & ');
                };
                
                matchesSnap.docs.forEach(d => {
                    const m = d.data();
                    if (m.team1Id === teamId || m.team2Id === teamId) {
                        const updatePayload: any = {};
                        if (m.team1Id === teamId) {
                            updatePayload.team1Name = name;
                            updatePayload.team1PlayerNames = formatPlayerNames(player1Name, player2Name);
                        }
                        if (m.team2Id === teamId) {
                            updatePayload.team2Name = name;
                            updatePayload.team2PlayerNames = formatPlayerNames(player1Name, player2Name);
                        }
                        const globalMatchRef = doc(db, "matches", d.id);
                        batch.set(globalMatchRef, { ...updatePayload, tournamentId: tId, id: d.id }, { merge: true });
                    }
                });
                await batch.commit();
            }
        } catch (e) {
            console.error("Error updating team in tournament:", e);
            throw e;
        }
    }
};


export const getCourtsByVenueIds = async (venueIds: string[]) => {
    if (!db) return [];
    if (!venueIds || venueIds.length === 0) return [];
    const courtsRef = collection(db, "courts");
    const q = query(courtsRef, where("venueId", "in", venueIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const resumeMatch = async (tId: string, mId: string) => {
    if (db) {
        const mRef = doc(db, "tournaments", tId, "matches", mId);
        const globalMatchRef = doc(db, "matches", mId);
        const updates = {
            status: MatchStatus.IN_PROGRESS,
            winnerTeamId: deleteField()
        };
        const batch = writeBatch(db);
        batch.set(mRef, updates, { merge: true });
        batch.set(globalMatchRef, { ...updates, tournamentId: tId, id: mId }, { merge: true });
        await batch.commit();
    }
};

export const startMatch = async (tId: any, mId: any, courtId?: string | null, courtName?: string | null, extraData?: any, conflictAcknowledged?: boolean | null) => {
    const updates = cleanData({
        status: MatchStatus.IN_PROGRESS,
        courtId: courtId || undefined,
        actualCourtId: courtId || undefined,
        court: courtName || undefined,
        conflictAcknowledged: conflictAcknowledged || undefined,
        scheduledStartTime: new Date().toISOString(),
        ...extraData
    });

    if (db) {
        try {
            const mRef = doc(db, "tournaments", tId, "matches", mId);
            const globalMatchRef = doc(db, "matches", mId);
            const obsIndexRef = doc(db, "obsIndex", mId);
            
            const batch = writeBatch(db);
            batch.set(mRef, updates, { merge: true });
            batch.set(globalMatchRef, { ...updates, tournamentId: tId, id: mId }, { merge: true });
            batch.set(obsIndexRef, { tournamentId: tId, matchId: mId, timestamp: new Date().toISOString() });
            await batch.commit();
        } catch (e) {
            console.error("Batch failed for startMatch, falling back to individual updates", e);
            await updateDoc(doc(db, "tournaments", tId, "matches", mId), updates);
            await updateDoc(doc(db, "matches", mId), updates).catch(() => {});
            const obsIndexRef = doc(db, "obsIndex", mId);
            await setDoc(obsIndexRef, { tournamentId: tId, matchId: mId, timestamp: new Date().toISOString() }).catch(() => {});
        }
    }
};
export const addRefereeTag = async (tId: any, mId: any, tag: any) => {
    console.log('tag', tag);
};
export const triggerBroadcastEvent = async (...args: any[]) => {
    console.log('broadcast', event);
};


export const loginReferee = async (...args: any[]) => {
    return true;
};


export const subscribeToPlayerQuickplaySessions = (...args: any[]) => { return () => {}; };




export const getCourtByToken = async (...args: any[]) => { return null; };


export const getVenueById = async (...args: any[]) => { return null; };
export const subscribeToGlobalStats = (...args: any[]) => { return () => {}; };


export const signUpUser = async (...args: any[]) => { return null; };


export const getCourtLeaderboard = async (...args: any[]) => { return []; };


export const subscribeToVenueQuickplayStats = (venueId: string, cb: any) => { return () => {}; };


export const createQuickplaySessionV2 = async (...args: any[]) => { return "dummy-id"; };
export const incrementGlobalMatches = async (...args: any[]) => {};
export const subscribeToQuickplaySessionV2 = (...args: any[]) => { return () => {}; };
export const updatePlayerStats = async (...args: any[]) => {};
export const updateQuickplaySessionV2 = async (...args: any[]) => {};

export const syncTournamentPlayersAndTeams = async (tId: string) => {
    try {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            
            const batch = writeBatch(db);
            let count = 0;
            
            for (const team of tData.teams) {
                if (team.status === 'ACCEPTED') {
                    const obRef = doc(db, 'onboardedTeams', team.id);
                    batch.set(obRef, {
                        ...team,
                        tournamentId: tId,
                        tournamentName: tData.name,
                        categoryName: tData.categories?.find(c => c.id === team.categoryId)?.name || team.categoryId || 'Unknown',
                        onboardedAt: new Date().toISOString()
                    }, { merge: true });
                    count++;
                }
            }
            if (count > 0) {
                await batch.commit();
            }
        }
    } catch (e) {
        console.error("Failed to sync tournament players and teams", e);
    }
};
export const syncSingleStandalonePlayerToGlobal = async (...args: any[]) => {};

export const bulkUploadPendingTeams = async (tId: string, newTeams: Team[]) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const snap = await getDoc(tRef);
        if (snap.exists()) {
            const tData = snap.data() as Tournament;
            await updateDoc(tRef, cleanData({ teams: [...(tData.teams||[]), ...newTeams] }));

            // Also save to onboardedTeams for cross-app visibility/history
            for (const team of newTeams) {
                const obRef = doc(db, 'onboardedTeams', team.id);
                await setDoc(obRef, cleanData({
                    ...team,
                    tournamentId: tId,
                    tournamentName: tData.name,
                    categoryName: tData.categories?.find(c => c.id === team.categoryId)?.name || tData.categories?.find(c => c.name === team.categoryId)?.name || 'Unknown',
                    onboardedAt: new Date().toISOString()
                }), { merge: true });
            }
        }
    }
};
