const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = query(collection(db, "matches"), limit(5));
  const snap = await getDocs(q);
  
  snap.forEach(doc => {
    console.log(doc.id, Object.keys(doc.data()));
  });
}
run();
