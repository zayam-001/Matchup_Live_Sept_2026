const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = collection(db, "tournaments");
  const snap = await getDocs(q);
  const out = [];
  snap.forEach(doc => {
    out.push({id: doc.id, name: doc.data().name});
  });
  console.log(JSON.stringify(out));
}
run();
