const fs = require('fs');
const path = 'components/OBSOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('useTournamentDoc')) {
    content = content.replace(
        /import \{ useMatchResult \} from "\.\.\/hooks\/useMatchResult";/,
        `import { useMatchResult } from "../hooks/useMatchResult";\nimport { useTournamentDoc } from "../hooks/useTournamentDoc";`
    );
}

content = content.replace(
    /const \{ matchData: liveMatch \} = useMatchResult\(matchId\);/,
    `const { matchData: liveMatch } = useMatchResult(matchId);\n  const { tournament } = useTournamentDoc(tournamentId || null);`
);

fs.writeFileSync(path, content);
console.log("Patched OBSOverlay with tournament hook");
