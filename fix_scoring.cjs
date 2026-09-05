const fs = require('fs');
const path = 'components/MatchScoringSystem.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('updateMatchScore')) {
  content = content.replace(
    "import { completeMatchAndAdvance } from '../services/matchCompletion';",
    "import { completeMatchAndAdvance } from '../services/matchCompletion';\nimport { updateMatchScore } from '../services/storage';"
  );
  
  content = content.replace(
    /const newScoreObj = buildScoreObject\(nextState\);/g,
    `const newScoreObj = buildScoreObject(nextState);
    if (mode === 'tournament' && tournamentId && matchId) {
        updateMatchScore(tournamentId, matchId, newScoreObj, "IN_PROGRESS").catch(err => console.error(err));
    }`
  );

  fs.writeFileSync(path, content);
  console.log("Fixed MatchScoringSystem updateMatchScore");
} else {
  console.log("Already has updateMatchScore");
}
