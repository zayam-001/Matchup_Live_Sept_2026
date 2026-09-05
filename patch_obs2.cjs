const fs = require('fs');
const path = 'components/OBSOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetRegex = /  const \[match, setMatch\] = useState<Match \| null>\(null\);[\s\S]*?(?=\/\/ Diagnostic Timeout Guard)/;

const replacement = `  const { matchData: liveMatch } = useMatchResult(matchId);
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (liveMatch) setMatch(liveMatch as Match);
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

  useEffect(() => {
    if (!match) return;

    const missing: string[] = [];
    if (!match.team1Name && !match.team1Id) missing.push("team1Name/team1Id missing");
    if (!match.team2Name && !match.team2Id) missing.push("team2Name/team2Id missing");
    if (!match.score) missing.push("score state missing");

    const fieldsCount = Object.keys(match).length;
    const hasScoreObj = !!match.score;
    const hasTeamsInfo = !!(match.team1Name || match.team1Id) && !!(match.team2Name || match.team2Id);

    setDebug((prev) => ({
      ...prev,
      matchFieldsCount: fieldsCount,
      hasTeams: hasTeamsInfo,
      hasScoreObj,
      hasStatus: !!match.status,
      missingFields: missing,
    }));

    console.log(\`[OBSOverlay Data Verification] Match "\${matchId}" state verified:\`, {
      hasTeams: hasTeamsInfo,
      hasScore: hasScoreObj,
      status: match.status,
      missing
    });
  }, [match, matchId]);

  `;

content = content.replace(targetRegex, replacement);
fs.writeFileSync(path, content);
console.log("Patched OBSOverlay.tsx successfully");
