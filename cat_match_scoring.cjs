const fs = require('fs');
console.log(fs.readFileSync('components/MatchScoringSystem.tsx', 'utf8').split('\n').slice(130, 150).join('\n'));
