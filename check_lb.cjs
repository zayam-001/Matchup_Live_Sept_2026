const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = collection(db, "leaderboard");
  const snap = await getDocs(query(q, limit(5)));
  console.log("Docs:", snap.size);
  process.exit(0);
}
run();
