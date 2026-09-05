const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const tRef = collection(db, "tournaments");
  const snap = await getDocs(tRef);
  
  let foundCatC = false;
  snap.forEach(doc => {
    const data = doc.data();
    if (data.categories) {
       for(let cat of data.categories) {
          if (cat.name === 'Category C' || cat.name === 'Category D' || cat.name === 'Category C ' || cat.name === 'Category D ') {
             console.log(`Found tournament: ${data.name} (${doc.id})`);
             console.log(`Categories:`, data.categories);
             foundCatC = true;
          }
       }
    }
  });
  if (!foundCatC) console.log("Did not find Category C or D");
}
run();
