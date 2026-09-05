const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, updateDoc } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const tId = "pdo4ZnplwOrSBQABR9Zh";
    
    const teamsRef = collection(db, `tournaments/${tId}/teams`);
    const teamsSnap = await getDocs(teamsRef);
    let ahmedSami = null;
    let ahsanMohib = null;
    let mbhAhmed = null;
    
    teamsSnap.forEach(t => {
        const d = t.data();
        if (d.name.includes("Ahmed") && d.name.includes("Sami")) ahmedSami = t.id;
        if (d.name.includes("Ahsan Ahmed") && d.name.includes("Mohib")) ahsanMohib = t.id;
        if (d.name.includes("MBH") && d.name.includes("Ahmed")) mbhAhmed = t.id;
    });
    console.log("Ahmed/Sami:", ahmedSami);
    console.log("Ahsan/Mohib:", ahsanMohib);
    console.log("MBH/Ahmed:", mbhAhmed);
    
    process.exit(0);
}
run();
