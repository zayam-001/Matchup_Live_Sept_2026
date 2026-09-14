const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const leaderboard = await getDocs(collection(db, "leaderboard"));
  let placeholders = 0;
  for (const doc of leaderboard.docs) {
      const d = doc.data();
      const name = (d.playerName || 'Unknown').trim();
      if (/^Player \d+$/i.test(name)) placeholders++;
  }
  console.log("Placeholders in LB:", placeholders);
  process.exit(0);
}
run();
