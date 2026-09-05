const fs = require('fs');
console.log(fs.readFileSync('components/LiveScoreboard.tsx', 'utf8').split('\n').slice(1330, 1360).join('\n'));
