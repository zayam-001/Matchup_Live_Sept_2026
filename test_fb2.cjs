const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const tId = "pdo4ZnplwOrSBQABR9Zh"; // Copa De Padel Season 3
    const teams = await getDocs(collection(db, `tournaments/${tId}/teams`));
    teams.forEach(t => {
        if (t.data().name.includes("Ahmed") || t.data().name.includes("Sami")) {
            console.log("Team:", t.id, t.data().name);
        }
    });

    const matches = await getDocs(collection(db, `tournaments/${tId}/matches`));
    matches.forEach(m => {
        const d = m.data();
        if (d.team1Name?.includes("Ahmed") || d.team2Name?.includes("Ahmed") || 
            d.team1Name?.includes("Sami") || d.team2Name?.includes("Sami")) {
            console.log("Match:", m.id, d.team1Name, "vs", d.team2Name, "Stage:", d.stage, "Status:", d.status);
        }
    });
    process.exit(0);
}
run();
