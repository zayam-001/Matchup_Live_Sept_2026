const fs = require('fs');
let content = fs.readFileSync('services/storage.ts', 'utf8');
content = content.replace(/matches\.forEach\(m => \{\s*\}/g, "matches.forEach(m => {\n        if ((m.status !== MatchStatus.COMPLETED && String(m.status).toUpperCase() !== 'FINISHED')) return;");
content = content.replace(/if \(!t\) \}\n/g, "if (!t) return;\n");
// What other returns were deleted? Let's fix processTeamStats!
content = content.replace(/const processTeamStats = \(tId: string \| undefined, tIsWinner: boolean, setsWon: number, setsLost: number, gamesWon: number, gamesLost: number, pointsToAdd: number\) => \{\s*if \(\!tId\) /g, 
"const processTeamStats = (tId: string | undefined, tIsWinner: boolean, setsWon: number, setsLost: number, gamesWon: number, gamesLost: number, pointsToAdd: number) => {\n            if (!tId) return;\n");
content = content.replace(/const t = teamMap\.get\(tId\);\s*if \(\!t\)/g, "const t = teamMap.get(tId);\n            if (!t) return;");
fs.writeFileSync('services/storage.ts', content);
