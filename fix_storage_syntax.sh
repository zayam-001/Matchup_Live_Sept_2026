sed -i 's/matches\.forEach(m => {/matches.forEach(m => {\n        if ((m.status !== MatchStatus.COMPLETED \&\& String(m.status).toUpperCase() !== '\''FINISHED'\'')) return;/g' services/storage.ts
sed -i '/matches.forEach(m => {/{n;d}' services/storage.ts
