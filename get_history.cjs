const fs = require('fs');
const content = fs.readFileSync('components/PlayerDashboard.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes("{pastMatches.length > 0 || quickplaySessions.filter"));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('</Card>') && lines[i+1] && lines[i+1].includes(')}'));

console.log("Start:", startIndex);
console.log("End:", endIndex + 2); // To include )}
fs.writeFileSync('history.txt', lines.slice(startIndex, endIndex + 2).join('\n'));
