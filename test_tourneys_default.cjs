const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = collection(db, "tournaments");
  try {
    const snap = await getDocs(q);
    console.log("Tournaments docs:", snap.size);
    snap.docs.forEach(d => console.log(d.id, d.data().name));
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
run();
