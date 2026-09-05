const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const app = initializeApp({ projectId: "ai-studio-matchupcompk-000e1464-9437-40ff-9865-3555fd0331b5" });
const db = getFirestore(app);
async function run() {
    const q = query(collection(db, "matches"));
    const snap = await getDocs(q);
    const matches = snap.docs.map(d => ({id: d.id, ...d.data()}));
    console.log("Total Matches:", matches.length);
    const counts = {};
    matches.forEach(m => {
        counts[m.id] = (counts[m.id] || 0) + 1;
    });
    const dups = Object.entries(counts).filter(e => e[1] > 1);
    console.log("Duplicate IDs:", dups);
    console.log("Sample matches:");
    console.dir(matches.slice(0, 3));
    process.exit(0);
}
run();
