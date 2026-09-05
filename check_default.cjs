const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = collection(db, "tournaments");
  const snap = await getDocs(query(q, limit(2)));
  let cnt = 0;
  snap.forEach(doc => {
    cnt++;
    const d = doc.data();
    console.log(doc.id, d.name, (d.categories || []).map(c => ({ id: c.id, name: c.name })));
  });
  console.log("Count:", cnt);
  process.exit(0);
}
run();
