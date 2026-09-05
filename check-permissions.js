import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "tournament-scoring-app-7dff5",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
      await getDocs(collection(db, "teams"));
      console.log("Teams OK");
  } catch(e) {
      console.log("Teams Error: " + e.message);
  }
  try {
      await getDocs(collection(db, "quickSessions"));
      console.log("QuickSessions OK");
  } catch(e) {
      console.log("QuickSessions Error: " + e.message);
  }
  process.exit(0);
}
test();
