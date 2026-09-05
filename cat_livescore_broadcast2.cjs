const fs = require('fs');
console.log(fs.readFileSync('components/LiveScoreboard.tsx', 'utf8').split('\n').slice(1360, 1390).join('\n'));
