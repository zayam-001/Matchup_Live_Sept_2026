const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const { calculateStats } = require('./dist/assets/index.es-B6UzbhlW.js'); // Cannot easily import TS, so I'll just copy the logic.
}
