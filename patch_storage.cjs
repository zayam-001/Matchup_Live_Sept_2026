const fs = require('fs');
let content = fs.readFileSync('services/storage.ts', 'utf8');
content = content.replace(
  `        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });`,
  `        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        }, (firebaseConfig as any).firestoreDatabaseId);`
);
fs.writeFileSync('services/storage.ts', content);
