const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const onboarded = await getDocs(collection(db, "onboardedPlayers"));
  const reals = onboarded.docs.map(d => d.data()).filter(d => {
    const name = String(d?.name || d?.playerName || '').trim();
    return !/^Player \d+$/i.test(name);
  });
  console.log("real ones count:", reals.length);
  console.log("sample:", reals.slice(0, 3));
  process.exit(0);
}
run();
