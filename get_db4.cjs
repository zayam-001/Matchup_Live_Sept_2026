const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = query(collection(db, "tournaments"), limit(10));
  const snap = await getDocs(q);
  
  snap.forEach(doc => {
    const d = doc.data();
    console.log(d.name, (d.categories || []).map(c => c.name));
  });
}
run();
