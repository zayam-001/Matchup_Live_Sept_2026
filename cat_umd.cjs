const fs = require('fs');
const lines = fs.readFileSync('services/storage.ts', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('export const updateMatchDetails'));
if (idx !== -1) {
    console.log(lines.slice(idx, idx + 40).join('\n'));
}
