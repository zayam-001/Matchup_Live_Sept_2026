const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace standard collection(db, "tournaments", tId, "matches") reads with query(collection(db, "matches"), where("tournamentId", "==", tId))
// 2077
content = content.replace(
  'const matchesCol = collection(db, "tournaments", tId, "matches");\n        const matchesSnap = await getDocs(matchesCol);',
  'const matchesCol = query(collection(db, "matches"), where("tournamentId", "==", tId));\n        const matchesSnap = await getDocs(matchesCol);'
);

// 2449
content = content.replace(
  '            const matchesCol = collection(db, "tournaments", tId, "matches");\n            const matchesSnap = await getDocs(matchesCol);',
  '            const matchesCol = query(collection(db, "matches"), where("tournamentId", "==", tId));\n            const matchesSnap = await getDocs(matchesCol);'
);

// 2532
content = content.replace(
  '    const matchesCol = collection(db, "tournaments", tId, "matches");\n    const existing = await getDocs(matchesCol);',
  '    const matchesCol = query(collection(db, "matches"), where("tournamentId", "==", tId));\n    const existing = await getDocs(matchesCol);'
);

// 2600
content = content.replace(
  '                const matchesSnap = await getDocs(collection(db, "tournaments", tId, "matches"));',
  '                const matchesSnap = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));'
);

// 2886
content = content.replace(
  '            const matchesSnap = await getDocs(collection(db, "tournaments", tId, "matches"));',
  '            const matchesSnap = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));'
);

// 3009
content = content.replace(
  '                    const matchesRef = collection(db, "tournaments", tId, "matches");\n                    const matchesSnap = await getDocs(matchesRef);',
  '                    const matchesRef = query(collection(db, "matches"), where("tournamentId", "==", tId));\n                    const matchesSnap = await getDocs(matchesRef);'
);

// 3043
content = content.replace(
  '                const matchesRef = collection(db, "tournaments", tId, "matches");\n                const matchesSnap = await getDocs(matchesRef);',
  '                const matchesRef = query(collection(db, "matches"), where("tournamentId", "==", tId));\n                const matchesSnap = await getDocs(matchesRef);'
);


fs.writeFileSync(path, content);
console.log("Patched storage.ts mass match reads");
