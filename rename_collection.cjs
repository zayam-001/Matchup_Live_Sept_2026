const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
    const oldCol = db.collection('player_leaderboard');
    const newCol = db.collection('leaderboard');
    const snap = await oldCol.get();
    
    let batch = db.batch();
    let count = 0;
    
    for (const doc of snap.docs) {
        batch.set(newCol.doc(doc.id), doc.data());
        count++;
        if (count > 400) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0) await batch.commit();
    console.log(`Copied ${snap.size} documents to 'leaderboard'.`);
}
main().catch(console.error);
