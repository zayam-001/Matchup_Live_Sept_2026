const fs = require('fs');
console.log(fs.readFileSync('components/LiveScoreboard.tsx', 'utf8').split('\n').slice(60, 90).join('\n'));
