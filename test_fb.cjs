const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const ts = await getDocs(collection(db, "tournaments"));
    ts.forEach(doc => console.log(doc.id, doc.data().name));
    process.exit(0);
}
run();
