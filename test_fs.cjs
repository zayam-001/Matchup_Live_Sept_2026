const { initializeApp } = require('firebase/app');
const { initializeFirestore, persistentLocalCache } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
}, firebaseConfig.firestoreDatabaseId);

console.log("DB Id:", db._databaseId.database);
