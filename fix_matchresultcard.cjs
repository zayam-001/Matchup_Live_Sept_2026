const fs = require('fs');
const path = 'components/MatchResultCard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '{match.score?.p1Games}',
  '{p1Games || (p1SetScores.length > 0 ? p1SetScores[0] : 0)}'
);

content = content.replace(
  '{match.score?.p2Games}',
  '{p2Games || (p2SetScores.length > 0 ? p2SetScores[0] : 0)}'
);

fs.writeFileSync(path, content);
console.log("Fixed MatchResultCard");
