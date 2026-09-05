const fs = require('fs');
const path = 'hooks/useLiveMatch.ts';
let content = fs.readFileSync(path, 'utf8');

const target = '    const matchRef = doc(db, `tournaments/${tournamentId}/matches/${matchId}`);';
const replacement = '    const matchRef = doc(db, `matches/${matchId}`);';

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log("Patched useLiveMatch.ts");
