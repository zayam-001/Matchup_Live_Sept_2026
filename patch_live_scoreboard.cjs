const fs = require('fs');
const path = 'components/LiveScoreboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { useLiveMatch } from '../hooks/useLiveMatch';",
  "import { useMatchResult } from '../hooks/useMatchResult';"
);
content = content.replaceAll(
  "const { matchData } = useLiveMatch(initialMatch.tournamentId, initialMatch.id);",
  "const { matchData } = useMatchResult(initialMatch.id);"
);

fs.writeFileSync(path, content);
console.log("Patched LiveScoreboard.tsx");
