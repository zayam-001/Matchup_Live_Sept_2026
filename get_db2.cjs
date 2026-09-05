const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const tRef = collection(db, "tournaments");
  const snap = await getDocs(tRef);
  
  snap.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.includes("MatchUp")) {
      console.log(data.name, doc.id);
      if (data.categories) {
         console.log(data.categories);
      }
    }
  });
}
run();
