import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "tournament-scoring-app-7dff5",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  const snap = await getDocs(collection(db, "tournaments"));
  let live = 0;
  let completed = 0;
  const now = new Date();
  
  snap.docs.forEach(doc => {
    const t = doc.data();
    let isPassed = false;
    if (t.endDate && new Date(t.endDate) < now) {
        isPassed = true;
    }
    if ((t.status === 'COMPLETED' || String(t.status).toUpperCase() === 'FINISHED') || t.status === 'RETIRED') {
        isPassed = true;
    }
    
    if (isPassed) completed++;
    else live++;
  });
  console.log(`Live: ${live}, Completed: ${completed}`);
  process.exit(0);
}
test();
