const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const q = query(collection(db, 'leaderboard'), limit(1));
    const snap = await getDocs(q);
    console.log("Success! Docs:", snap.size);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
