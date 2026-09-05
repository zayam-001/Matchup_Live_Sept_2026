const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const tId = "mD3BD4WWP0xeWDaXhA6Y"; // APEX 8.0
  const q = collection(db, "tournaments");
  const snap = await getDocs(q);
  
  snap.forEach(doc => {
    if (doc.id !== tId) return;
    const data = doc.data();
    if (data.teams) {
       data.teams.forEach(t => {
          console.log(t.name, t.categoryId, t.categoryName);
       });
    }
  });
  process.exit(0);
}
run();
