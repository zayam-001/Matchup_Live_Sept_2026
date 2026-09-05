const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, limit } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const matchesCol = collection(db, "matches");
  const snap = await getDocs(query(matchesCol, limit(50)));
  let missing = 0;
  snap.forEach(doc => {
    const d = doc.data();
    if (!d.tournamentId) {
      missing++;
      console.log("Missing tournamentId for match:", doc.id);
    }
  });
  console.log("Total missing out of 50:", missing);
  process.exit(0);
}
run();
