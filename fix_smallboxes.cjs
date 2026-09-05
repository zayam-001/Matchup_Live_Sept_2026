const fs = require('fs');
const path = 'components/MatchResultCard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const hasSetScores = p1SetScores.length > 0;',
  'const hasSetScores = p1SetScores.length > 0 && !isSingleGameFormat;'
);

fs.writeFileSync(path, content);
console.log("Fixed small boxes");
