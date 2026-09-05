const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

// Function 1 (around 2449)
let t1 = `            const matchesCol = query(collection(db, "matches"), where("tournamentId", "==", tId));
            const existing = await getDocs(matchesCol);`;
let r1 = `            const matchesCol = collection(db, "tournaments", tId, "matches");
            const existing = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));`;
content = content.replace(t1, r1);

// Function 2 (around 2532)
let t2 = `    const matchesCol = query(collection(db, "matches"), where("tournamentId", "==", tId));
    const existing = await getDocs(matchesCol);`;
let r2 = `    const matchesCol = collection(db, "tournaments", tId, "matches");
    const existing = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));`;
content = content.replace(t2, r2);

// Let's double check 2077
let t3 = `const matchesCol = query(collection(db, "matches"), where("tournamentId", "==", tId));
        const matchesSnap = await getDocs(matchesCol);`;
let r3 = `const matchesCol = query(collection(db, "matches"), where("tournamentId", "==", tId));
        const matchesSnap = await getDocs(matchesCol);`; // no change needed if it's not used for doc()
content = content.replace(t3, r3);

fs.writeFileSync(path, content);
console.log("Fixed doc() typing issues");
