const fs = require('fs');
const path = 'components/MatchResultCard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const hasSetScores = p1SetScores.length > 0 && !isSingleGameFormat;\n    const isSingleGameFormat = (p1Sets === 0 && p2Sets === 0 && (p1Games > 0 || p2Games > 0)) || (p1SetScores.length === 1 && (p1SetScores[0] > 1 || p2SetScores[0] > 1));',
  'const isSingleGameFormat = (p1Sets === 0 && p2Sets === 0 && (p1Games > 0 || p2Games > 0)) || (p1SetScores.length === 1 && (p1SetScores[0] > 1 || p2SetScores[0] > 1));\n    const hasSetScores = p1SetScores.length > 0 && !isSingleGameFormat;'
);

fs.writeFileSync(path, content);
console.log("Fixed MatchResultCard variable ordering");
