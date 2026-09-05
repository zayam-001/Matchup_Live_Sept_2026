import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, calculateStats, checkAndHealTournamentStats } from './services/storage';

async function run() {
    const tId = "pdo4ZnplwOrSBQABR9Zh";
    const docRef = doc(db, "tournaments", tId);
    const snap = await getDoc(docRef);
    const t = snap.data();
    
    const matchesSnap = await getDocs(collection(db, "tournaments/" + tId + "/matches"));
    const matches: any[] = [];
    matchesSnap.forEach(m => matches.push({id: m.id, ...m.data()}));
    
    const newStats = calculateStats(t.teams || [], matches, t.format);
    
    const ahmedSami = newStats.find((team: any) => team.id === "29jswjkuz");
    console.log("Ahmed/Sami Stats:", ahmedSami);

    // Call heal to see if it works
    await checkAndHealTournamentStats({id: tId, ...t} as any, matches);
    console.log("Heal finished.");

    process.exit(0);
}
run();
