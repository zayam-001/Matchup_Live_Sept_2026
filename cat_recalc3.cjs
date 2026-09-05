const fs = require('fs');
const lines = fs.readFileSync('services/storage.ts', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('export const recalculateMatchResult'));
if (idx !== -1) {
    console.log(lines.slice(idx + 140, idx + 200).join('\n'));
}
