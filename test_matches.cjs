const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const tId = "pdo4ZnplwOrSBQABR9Zh";
    
    const rootMatches = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));
    console.log("Root matches count:", rootMatches.size);
    
    const subMatches = await getDocs(collection(db, `tournaments/${tId}/matches`));
    console.log("Subcollection matches count:", subMatches.size);
    
    process.exit(0);
}
run();
