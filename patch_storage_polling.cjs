const fs = require('fs');
let content = fs.readFileSync('services/storage.ts', 'utf8');

content = content.replace(
  `        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        }, (firebaseConfig as any).firestoreDatabaseId);`,
  `        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          experimentalForceLongPolling: true
        }, (firebaseConfig as any).firestoreDatabaseId);`
);

content = content.replace(
  `                db = initializeFirestore(app, {
                    localCache: memoryLocalCache()
                }, (firebaseConfig as any).firestoreDatabaseId);`,
  `                db = initializeFirestore(app, {
                    localCache: memoryLocalCache(),
                    experimentalForceLongPolling: true
                }, (firebaseConfig as any).firestoreDatabaseId);`
);

fs.writeFileSync('services/storage.ts', content);
