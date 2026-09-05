const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = collection(db, "leaderboard");
  try {
    const snap = await getDocs(query(q, limit(5)));
    console.log("Docs:", snap.size);
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
run();
