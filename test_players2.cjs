const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const players = await getDocs(collection(db, "players"));
  const onboarded = await getDocs(collection(db, "onboardedPlayers"));
  const leaderboard = await getDocs(collection(db, "leaderboard"));
  console.log("players docs:", players.size);
  console.log("onboardedPlayers docs:", onboarded.size);
  console.log("leaderboard docs:", leaderboard.size);
  process.exit(0);
}
run();
