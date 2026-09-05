const fs = require('fs');
const path = 'components/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /await addKnockoutMatch\(tournament\.id, categoryId, name, team1Id, team2Id\);/,
  `let actualCat = categoryId;
            if (!actualCat && team1Id) {
                const t1 = tournament.teams?.find(t => t.id === team1Id);
                if (t1 && t1.categoryId) actualCat = t1.categoryId;
            }
            await addKnockoutMatch(tournament.id, actualCat, name, team1Id, team2Id);`
);

content = content.replace(
  /await addKnockoutMatch\(\s*tournament\.id,\s*categoryId,\s*suggestion\.roundName,\s*suggestion\.team1Id,\s*suggestion\.team2Id,/g,
  `let actualCat = categoryId;
            if (!actualCat && suggestion.team1Id) {
                const t1 = tournament.teams?.find(t => t.id === suggestion.team1Id);
                if (t1 && t1.categoryId) actualCat = t1.categoryId;
            }
            await addKnockoutMatch(
                tournament.id,
                actualCat,
                suggestion.roundName,
                suggestion.team1Id,
                suggestion.team2Id,`
);

fs.writeFileSync(path, content);
console.log("Fixed AdminDashboard actualCat");
