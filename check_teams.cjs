const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

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
       let noCat = 0;
       data.teams.forEach(t => {
          if (!t.categoryId && !t.categoryName) {
             noCat++;
             console.log("Team missing category:", t.name, t.id);
          } else {
             // console.log("Team has category:", t.name, t.categoryId, t.categoryName);
          }
       });
       console.log("Total teams missing category:", noCat);
    }
  });
  process.exit(0);
}
run();
