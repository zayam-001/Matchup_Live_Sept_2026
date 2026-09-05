const fs = require('fs');
const path = 'components/RefereeInterface.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes("useMatchResult")) {
  content = content.replace(
    "import { WinnerBanner } from './WinnerBanner';",
    "import { WinnerBanner } from './WinnerBanner';\nimport { useMatchResult } from '../hooks/useMatchResult';"
  );
}

const target = "const ScoringControl = ({ match, teams, tournamentId, isAmericano, onUpdate, onBack, onShowBanner }: any) => {\n    const t1 = teams.find((t: any) => t.id === match.team1Id);\n    const t2 = teams.find((t: any) => t.id === match.team2Id);";

const replacement = "const ScoringControl = ({ match: initialMatch, teams, tournamentId, isAmericano, onUpdate, onBack, onShowBanner }: any) => {\n    const { matchData: liveMatch } = useMatchResult(initialMatch?.id);\n    const match = liveMatch || initialMatch;\n    const t1 = teams.find((t: any) => t.id === match.team1Id);\n    const t2 = teams.find((t: any) => t.id === match.team2Id);";

content = content.replace(target, replacement);

fs.writeFileSync(path, content);
console.log("Patched RefereeInterface.tsx");
