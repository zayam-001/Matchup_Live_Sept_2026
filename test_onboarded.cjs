const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const onboarded = await getDocs(query(collection(db, "onboardedPlayers"), limit(5)));
  onboarded.docs.forEach(d => console.log(d.data()));
  process.exit(0);
}
run();
