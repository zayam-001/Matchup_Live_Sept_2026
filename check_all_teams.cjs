const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const tId = "pdo4ZnplwOrSBQABR9Zh";
    
    const teamsRef = collection(db, `tournaments/${tId}/teams`);
    const teamsSnap = await getDocs(teamsRef);
    console.log("Total teams in teams subcollection:", teamsSnap.size);
    teamsSnap.forEach(t => {
        console.log("Team:", t.id);
    });
    
    const t = await require('firebase/firestore').getDoc(require('firebase/firestore').doc(db, "tournaments", tId));
    console.log("Total teams in tournament doc teams array:", t.data().teams?.length);
    t.data().teams?.forEach(t => {
        const p1 = t.player1?.name || "";
        const p2 = t.player2?.name || "";
        const name = t.name || "";
        if (p1.includes("Ahmed") || p2.includes("Ahmed") || name.includes("Ahmed") || p1.includes("Sami") || p2.includes("Sami") || name.includes("Sami")) {
            console.log("Team in doc:", t.id, "Name:", name, "P1:", p1, "P2:", p2, "Status:", t.status, "Group:", t.groupId);
        }
    });

    process.exit(0);
}
run();
