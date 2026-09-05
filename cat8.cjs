const fs = require('fs');
const lines = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8').split('\n');
console.log(lines.slice(280, 295).map((l, i) => (i + 280) + ': ' + l).join('\n'));
