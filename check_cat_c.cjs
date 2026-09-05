const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = collection(db, "tournaments");
  const snap = await getDocs(q);
  
  snap.forEach(doc => {
    const data = doc.data();
    if (data.categories) {
       for(let cat of data.categories) {
          if (cat.name.includes('Category C') || cat.name.includes('Category D')) {
             console.log(`Found tournament: ${data.name} (${doc.id})`);
             console.log(`Categories:`, data.categories);
             return;
          }
       }
    }
  });
  process.exit(0);
}
run();
