const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const tId = "pdo4ZnplwOrSBQABR9Zh";
    
    const teamsRef = collection(db, `tournaments/${tId}/teams`);
    const teamsSnap = await getDocs(teamsRef);
    teamsSnap.forEach(t => {
        const d = t.data();
        const p1 = d.player1?.name || "";
        const p2 = d.player2?.name || "";
        const name = d.name || "";
        
        if (p1.includes("Ahmed") || p2.includes("Ahmed") || name.includes("Ahmed")) {
            console.log("Team:", t.id, "Name:", name, "P1:", p1, "P2:", p2, "Status:", d.status, "Group:", d.groupId);
        }
    });
    
    process.exit(0);
}
run();
