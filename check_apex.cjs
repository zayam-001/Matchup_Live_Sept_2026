const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const tId = "mD3BD4WWP0xeWDaXhA6Y"; // APEX 8.0
  const matchesCol = collection(db, `tournaments/${tId}/matches`);
  const snap = await getDocs(matchesCol);
  
  console.log("Matches in APEX 8.0 subcollection:", snap.size);
  let globalMissing = 0;
  for (let d of snap.docs) {
     const gSnap = await getDoc(doc(db, "matches", d.id));
     if (!gSnap.exists()) {
        globalMissing++;
     } else {
        const gData = gSnap.data();
        if (!gData.tournamentId) {
           console.log("Global match missing tournamentId:", d.id);
        }
     }
  }
  console.log("Global missing entirely:", globalMissing);
  process.exit(0);
}
run();
