const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

code = code.replace(/t => !categoryId \|\| t\.categoryId === categoryId/g, "t => isTeamInCategory(t, categoryId, tournament)");

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log("Done");
