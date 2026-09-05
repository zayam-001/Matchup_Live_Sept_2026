const fs = require('fs');
let code = fs.readFileSync('services/storage.ts', 'utf8');

code = code.replace(
  'export const addKnockoutMatch = async (tId: string, payload: any) => {',
  'export const addKnockoutMatch = async (...args: any[]) => {'
);

code = code.replace(
  'export const startMatch = async (tId: any, mId: any) => {',
  'export const startMatch = async (tId: any, mId: any, ...args: any[]) => {'
);

const oldEditTeam = `export const editTeamInTournament = async (tId: string, teamId: string, updates: any) => {
    console.log('Editing', teamId, updates);
};`;

const newEditTeam = `export const editTeamInTournament = async (tId: string, teamId: string, name: string, player1Name: string, player2Name: string) => {
    if (db) {
        const tRef = doc(db, "tournaments", tId);
        const tSnap = await getDoc(tRef);
        if (tSnap.exists()) {
            const t = tSnap.data() as Tournament;
            const updatedTeams = t.teams.map(team => {
                if (team.id === teamId) {
                    return { ...team, name, player1Name, player2Name };
                }
                return team;
            });
            await updateDoc(tRef, { teams: updatedTeams });

            const matchesRef = collection(db, "tournaments", tId, "matches");
            const matchesSnap = await getDocs(matchesRef);
            const batch = writeBatch(db);
            matchesSnap.docs.forEach(d => {
                const m = d.data();
                let needsUpdate = false;
                const updatePayload: any = {};
                if (m.team1Id === teamId) {
                    updatePayload.team1Name = name;
                    needsUpdate = true;
                }
                if (m.team2Id === teamId) {
                    updatePayload.team2Name = name;
                    needsUpdate = true;
                }
                if (needsUpdate) {
                    batch.update(d.ref, updatePayload);
                    const globalMatchRef = doc(db, "matches", d.id);
                    batch.update(globalMatchRef, updatePayload);
                }
            });
            await batch.commit();

            const standingRef = doc(db, "tournaments", tId, "standings", teamId);
            await setDoc(standingRef, { name, player1Name, player2Name }, { merge: true });
        }
    } else {
        const t = mockTournaments.find(x => x.id === tId);
        if (t) {
            t.teams = t.teams.map(team => team.id === teamId ? { ...team, name, player1Name, player2Name } : team);
            t.matches = t.matches.map(m => {
                let updated = { ...m };
                if (m.team1Id === teamId) updated.team1Name = name;
                if (m.team2Id === teamId) updated.team2Name = name;
                return updated;
            });
            notifyMock();
        }
    }
};`;

code = code.replace(oldEditTeam, newEditTeam);

fs.writeFileSync('services/storage.ts', code);
