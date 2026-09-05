const { initializeApp } = require('firebase/app');
const { getFirestore, getDoc, doc } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const tId = "pdo4ZnplwOrSBQABR9Zh";
    const t = await getDoc(doc(db, "tournaments", tId));
    console.log("Format:", t.data().format);
    process.exit(0);
}
run();
