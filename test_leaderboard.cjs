const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const leaderboard = await getDocs(collection(db, "leaderboard"));
  const byName = new Map();
  for (const doc of leaderboard.docs) {
      const d = doc.data();
      const name = (d.playerName || 'Unknown').trim();
      const key = name.toLowerCase();
      if (!byName.has(key)) {
          byName.set(key, true);
      }
  }
  console.log("Unique leaderboard names:", byName.size);
  process.exit(0);
}
run();
