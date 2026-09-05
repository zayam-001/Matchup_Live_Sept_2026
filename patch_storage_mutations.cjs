const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. addKnockoutMatch
content = content.replace(
  '        await setDoc(doc(db, "tournaments", tId, "matches", payload.id), payload);\n    }',
  '        const batch = writeBatch(db);\n        batch.set(doc(db, "tournaments", tId, "matches", payload.id), payload);\n        batch.set(doc(db, "matches", payload.id), { ...payload, tournamentId: tId, id: payload.id });\n        await batch.commit();\n    }'
);

// 2. deleteMatch
content = content.replace(
  '    if(db) await deleteDoc(doc(db, "tournaments", tId, "matches", mId));',
  '    if(db) {\n        const batch = writeBatch(db);\n        batch.delete(doc(db, "tournaments", tId, "matches", mId));\n        batch.delete(doc(db, "matches", mId));\n        await batch.commit();\n    }'
);

fs.writeFileSync(path, content);
console.log("Patched storage.ts mutations");
