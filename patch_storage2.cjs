const fs = require('fs');
let content = fs.readFileSync('services/storage.ts', 'utf8');

// Replace both instances where I added it
content = content.replace(
  `        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        }, (firebaseConfig as any).firestoreDatabaseId);`,
  `        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });`
);

content = content.replace(
  `            db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);`,
  `            db = getFirestore(app);`
);

content = content.replace(
  `                db = initializeFirestore(app, {
                    localCache: memoryLocalCache()
                }, (firebaseConfig as any).firestoreDatabaseId);`,
  `                db = initializeFirestore(app, {
                    localCache: memoryLocalCache()
                });`
);

content = content.replace(
  `                    db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);`,
  `                    db = getFirestore(app);`
);

fs.writeFileSync('services/storage.ts', content);
