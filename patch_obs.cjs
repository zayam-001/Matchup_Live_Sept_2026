const fs = require('fs');
const path = 'components/OBSOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'import { Match, MatchStatus } from "../types";',
  'import { Match, MatchStatus } from "../types";\nimport { useMatchResult } from "../hooks/useMatchResult";'
);

const target = `  const [match, setMatch] = useState<Match | null>(null);

  // Debug states
  const [debug, setDebug] = useState({
    resolvedMatchId: matchId,
    resolvedTournamentId: tournamentId,
    matchFieldsCount: 0,
    hasTeams: false,
    hasScoreObj: false,
    hasStatus: false,
    isCompleted: false,
    p1Sets: 0,
    p2Sets: 0,
    p1Games: 0,
    p2Games: 0,
    p1Pts: "0",
    p2Pts: "0",
    missingFields: [] as string[]
  });
  const [showDebug, setShowDebug] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Global collection listener (Primary)
  useEffect(() => {
    if (!matchId) {
      console.warn("[OBSOverlay] Warning: No matchId provided to component.");
      return;
    }
    
    console.log(\`[OBSOverlay Init] Subscribing for matchId="\${matchId}", tournamentId="\${tournamentId || 'unresolved'}"\`);

    let unsub: any = null;

    if (db) {
      // 1. Primary listener: doc(db, "matches", matchId)
      const globalMatchRef = doc(db, "matches", matchId);
      console.log(\`[OBSOverlay] Attaching listener to global doc("matches/\${matchId}")\`);
      
      unsub = onSnapshot(
        globalMatchRef,
        (docSnap) => {
          const exists = docSnap.exists();
          console.log(\`[OBSOverlay Snapshot] Global doc("matches/\${matchId}") exists: \${exists}\`);
          
          if (exists) {
            const data = docSnap.data() as Match;
            setMatch({ id: docSnap.id, ...data });
            console.log(\`[OBSOverlay Data] Global match record retrieved:\`, {
              id: docSnap.id,
              status: data.status,
              score: data.score,
              t1: data.team1Name || data.team1Id,
              t2: data.team2Name || data.team2Id
            });

            // Auto-heal tournamentId if missing
            if (!tournamentId && data.tournamentId) {
              console.log(\`[OBSOverlay Discovery] Found tournamentId="\${data.tournamentId}" in global match doc\`);
            }
          }
        },
        (err) => console.error("[OBSOverlay Error] Listening to global match:", err)
      );

      // Diagnostic: Check if obsIndex has an entry
      if (matchId) {
        console.log(\`[OBSOverlay Index] Searching obsIndex for matchId="\${matchId}"...\`);
        getDoc(doc(db, "obsIndex", matchId))
          .then((snap) => {
            const exists = snap.exists();
            console.log(\`[OBSOverlay Index] obsIndex/\${matchId} exists: \${exists}\`);
            if (exists) {
              console.log(\`[OBSOverlay Index] obsIndex/\${matchId} data: \`, snap.data());
            }
          })
          .catch(e => console.error("[OBSOverlay Index Error]", e));
      }
    }

    return () => {
      if (unsub) {
        console.log(\`[OBSOverlay Cleanup] Unsubscribing global match listener for "\${matchId}"\`);
        unsub();
      }
    };
  }, [matchId, tournamentId]);

  // Fallback match discovery across tournament collections if tournamentId is missing
  useEffect(() => {
    if (!matchId || tournamentId || !db) return;
    
    let isMounted = true;
    console.log(\`[OBSOverlay Fallback] Executing deep scan across tournaments to locate matchId="\${matchId}"...\`);
    
    const findMatchInTournaments = async () => {
      try {
        // Strategy A: Query collectionGroup('matches')
        const matchesGroupRef = collectionGroup(db, 'matches');
        const matchesGroupSnap = await getDocs(matchesGroupRef);
        
        let foundTournamentId: string | null = null;
        let foundData: any = null;

        matchesGroupSnap.forEach((docSnap) => {
          if (docSnap.id === matchId) {
            foundData = docSnap.data();
            // Path format: tournaments/{tournamentId}/matches/{matchId}
            const pathParts = docSnap.ref.path.split('/');
            if (pathParts.length >= 4 && pathParts[0] === 'tournaments') {
              foundTournamentId = pathParts[1];
            }
          }
        });

        if (foundData && foundTournamentId) {
          console.log(\`[OBSOverlay Fallback Success] Found matchId="\${matchId}" in tournament "\${foundTournamentId}" via collectionGroup search\`);
          if (isMounted) setMatch({ id: matchId, ...foundData });
          return; // Done
        }

        // Strategy B: Iterate active tournaments
        const toursSnap = await getDocs(collection(db, "tournaments"));
        for (const tDoc of toursSnap.docs) {
          const tData = tDoc.data();
          // Check inline matches array
          if (Array.isArray(tData.matches)) {
            const mMatch = tData.matches.find((m: any) => String(m.id) === String(matchId));
            if (mMatch) {
              if (isMounted) {
                setMatch({ id: matchId, ...mMatch, tournamentId: tDoc.id });
              }
              console.log(\`[OBSOverlay Fallback Success] Found matchId="\${matchId}" inside tournament document "\${foundTournamentId}" matches array\`);
              return;
            }
          }
        }

        if (isMounted) {
          console.warn(\`[OBSOverlay Fallback Warning] MatchId="\${matchId}" was not found in any active tournament collection.\`);
        }
      } catch (err) {
        console.error("[OBSOverlay Fallback Error] Exception while searching for match:", err);
      }
    };
    findMatchInTournaments();
    return () => { isMounted = false; };
  }, [matchId, tournamentId]);

  // Secondary subcollection listener (Fallback)
  useEffect(() => {
    if (!matchId || !tournamentId || !db) return;
    
    let unsubM: any = null;
    let unsubT: any = null;

    console.log(\`[OBSOverlay Subcollection] Subscribing to "tournaments/\${tournamentId}/matches/\${matchId}" and "tournaments/\${tournamentId}"\`);

    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    unsubM = onSnapshot(
      matchRef,
      (docSnap) => {
        const exists = docSnap.exists();
        console.log(\`[OBSOverlay Snapshot] Subcollection match doc exists: \${exists}\`);
        if (exists) {
          setMatch((prev) => ({ ...prev, id: docSnap.id, ...(docSnap.data() as Match) }));
        }
      },
      (err) => console.error("[OBSOverlay Error] Listening to subcollection match:", err)
    );

    // Also listen to the tournament doc in case the match is stored inline
    const tRef = doc(db, "tournaments", tournamentId);
    unsubT = onSnapshot(
      tRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const tData = docSnap.data();
          if (tData?.matches && Array.isArray(tData.matches)) {
            const foundInArray = tData.matches.find(
              (m: any) => String(m.id) === String(matchId)
            );
            if (foundInArray) {
              console.log(\`[OBSOverlay Data] Match found inside tournament.matches array\`);
              setMatch((prev) => ({ ...prev, id: matchId, ...foundInArray }));
            }
          }
        }
      }
    );

    return () => {
      if (unsubM) unsubM();
      if (unsubT) unsubT();
    };
  }, [matchId, tournamentId]);`;

const replacement = `  const { matchData: liveMatch } = useMatchResult(matchId);
  const [match, setMatch] = useState<Match | null>(null);
  
  useEffect(() => {
    if (liveMatch) setMatch(liveMatch);
  }, [liveMatch]);

  // Debug states
  const [debug, setDebug] = useState({
    resolvedMatchId: matchId,
    resolvedTournamentId: tournamentId,
    matchFieldsCount: 0,
    hasTeams: false,
    hasScoreObj: false,
    hasStatus: false,
    isCompleted: false,
    p1Sets: 0,
    p2Sets: 0,
    p1Games: 0,
    p2Games: 0,
    p1Pts: "0",
    p2Pts: "0",
    missingFields: [] as string[]
  });
  const [showDebug, setShowDebug] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log("Patched OBSOverlay.tsx");
