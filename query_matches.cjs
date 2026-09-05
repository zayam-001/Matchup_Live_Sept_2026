const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: "ai-studio-matchupcompk-000e1464-9437-40ff-9865-3555fd0331b5" });
const db = getFirestore();

async function run() {
  const matchesSnap = await db.collection('matches').limit(500).get();
  const matches = matchesSnap.docs.map(d => ({id: d.id, ...d.data()}));
  
  console.log("Total matches:", matches.length);
  
  const manualMatches = matches.filter(m => m.roundName && m.roundName.includes('Round of'));
  console.log("Manual matches with 'Round of':", manualMatches);
}
run();
