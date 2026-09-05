const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `        if (matches && matches.length > 0) {
            const batch = writeBatch(db);
            const matchesCol = collection(db, "tournaments", docRef.id, "matches");
            matches.forEach((m: Match) => {
                const mRef = doc(matchesCol, m.id);
                batch.set(mRef, cleanData(m));
            });
            await batch.commit();
        }`;
        
const replacement = `        if (matches && matches.length > 0) {
            const batch = writeBatch(db);
            const matchesCol = collection(db, "tournaments", docRef.id, "matches");
            const globalMatchesCol = collection(db, "matches");
            matches.forEach((m: Match) => {
                const mRef = doc(matchesCol, m.id);
                const gRef = doc(globalMatchesCol, m.id);
                batch.set(mRef, cleanData(m));
                batch.set(gRef, cleanData({ ...m, tournamentId: docRef.id }));
            });
            await batch.commit();
        }`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log("Patched storage.ts import mutations");
