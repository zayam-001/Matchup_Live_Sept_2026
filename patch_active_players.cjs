const fs = require('fs');
const file = './components/PublicLandingStats.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `        const unsubPlayers = onSnapshot(collection(db, 'onboardedPlayers'), (snap) => {
            const realPlayers = snap.docs.filter(d => !isPlaceholderPlayer(d.data()));
            if (mounted) {
                setStats(prev => ({ ...prev, activePlayers: realPlayers.length }));
            }
        });`;

const replacement = `        const unsubPlayers = onSnapshot(collection(db, 'leaderboard'), (snap) => {
            const rawEntries = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    name: (d.playerName || 'Unknown').trim(),
                    matchesPlayed: d.matchesPlayed || 0,
                    lastUpdatedMs: d.lastUpdated?.toMillis ? d.lastUpdated.toMillis() : 0,
                };
            });
            const byName = new Map();
            for (const entry of rawEntries) {
                const key = entry.name.toLowerCase();
                const existing = byName.get(key);
                if (!existing) {
                    byName.set(key, entry);
                    continue;
                }
                const entryIsBetter = entry.matchesPlayed !== existing.matchesPlayed
                    ? entry.matchesPlayed > existing.matchesPlayed
                    : entry.lastUpdatedMs > existing.lastUpdatedMs;
                if (entryIsBetter) byName.set(key, entry);
            }
            if (mounted) {
                setStats(prev => ({ ...prev, activePlayers: byName.size }));
            }
        });`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
console.log("Patched successfully");
