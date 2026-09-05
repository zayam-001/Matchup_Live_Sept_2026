const fs = require('fs');
const lines = fs.readFileSync('services/matchCompletion.ts', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('export const completeMatchAndAdvance'));
if (idx !== -1) {
    console.log(lines.slice(idx, idx + 80).join('\n'));
}
