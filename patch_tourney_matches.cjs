const fs = require('fs');
const path = 'hooks/useTournamentMatches.ts';
let content = fs.readFileSync(path, 'utf8');

const target = '    const q = query(\n      collection(db, `tournaments/${tournamentId}/matches`)\n    );';
const replacement = '    const q = query(\n      collection(db, "matches"),\n      where("tournamentId", "==", tournamentId)\n    );';

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log("Patched useTournamentMatches.ts");
