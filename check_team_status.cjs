const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const tId = "mD3BD4WWP0xeWDaXhA6Y"; 
  const q = collection(db, "tournaments");
  const snap = await getDocs(q);
  
  snap.forEach(doc => {
    if (doc.id !== tId) return;
    const data = doc.data();
    if (data.teams) {
       data.teams.forEach(t => {
          if (t.categoryId === "3z77jonsv") {
             console.log(t.name, t.status);
          }
       });
    }
  });
  process.exit(0);
}
run();
