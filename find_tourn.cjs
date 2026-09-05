const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = collection(db, "tournaments");
  const snap = await getDocs(q);
  
  snap.forEach(doc => {
    const d = doc.data();
    if (d.teams && d.teams.some(t => t.name && t.name.includes('Ghufran'))) {
       console.log("Found tournament:", d.name, doc.id);
       const gh = d.teams.find(t => t.name.includes('Ghufran'));
       console.log("Ghufran team:", gh);
    }
  });
}
run();
