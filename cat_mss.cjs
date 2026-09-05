const fs = require('fs');
const lines = fs.readFileSync('components/MatchScoringSystem.tsx', 'utf8').split('\n');
console.log(lines.slice(140, 160).join('\n'));
