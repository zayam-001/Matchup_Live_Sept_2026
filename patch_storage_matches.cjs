const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

const target = '            unsubM = onSnapshot(collection(db, "tournaments", tId, "matches"), (snap) => {';
const replacement = '            unsubM = onSnapshot(query(collection(db, "matches"), where("tournamentId", "==", tId)), (snap) => {';

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log("Patched storage.ts subscribeToTournament");
