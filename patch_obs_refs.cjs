const fs = require('fs');
const path = 'components/OBSOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = '  const { matchData: liveMatch } = useMatchResult(matchId);';
const replacement = `  const [tournamentId, setTournamentId] = useState(initialTournamentId);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevSetsRef = useRef<{p1: number, p2: number}>({p1: 0, p2: 0});
  const points1Ref = useRef<HTMLDivElement>(null);
  const points2Ref = useRef<HTMLDivElement>(null);
  const scoreRefs = useRef<Array<HTMLDivElement | null>>([]);
  const stingActiveRef = useRef<boolean>(false);
  const stingLayerRef = useRef<HTMLDivElement>(null);
  const stingRuleRef = useRef<HTMLDivElement>(null);
  const stingBodyRef = useRef<HTMLDivElement>(null);
  const stingLine1Ref = useRef<HTMLDivElement>(null);
  const stingLine2Ref = useRef<HTMLDivElement>(null);
  const stingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [diagnostics, setDiagnostics] = useState<OBSDiagnosticsState>({
    globalDocExists: null,
    obsIndexExists: null,
    subcollectionDocExists: null,
    tournamentDocExists: null,
    fallbackSearchRan: false,
    resolvedMatchId: matchId,
    resolvedTournamentId: initialTournamentId || null,
    matchFieldsCount: 0,
    hasScore: false,
    hasTeams: false,
    missingFields: [],
    cssConstraintsPassed: true,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    lastScoreUpdate: null
  });

  const { matchData: liveMatch } = useMatchResult(matchId);`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log("Patched OBSOverlay.tsx refs");
