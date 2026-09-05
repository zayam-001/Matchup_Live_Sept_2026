const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /export const addKnockoutMatch = async \(\.\.\.args: any\[\]\) => \{\n\s*const \[tId, categoryId, roundName, team1Id, team2Id, scheduledTime, court\] = args;/g,
  `export const addKnockoutMatch = async (...args: any[]) => {
    const [tId, categoryIdArg, roundName, team1Id, team2Id, scheduledTime, court] = args;
    
    // Resolve categoryId if missing by checking team1
    let categoryId = categoryIdArg;
    if ((!categoryId || categoryId === 'ALL') && team1Id) {
        // We need to fetch the tournament to find the team's category if possible.
        // We will do it asynchronously below.
    }`
);

// We can just fix it in AdminDashboard instead!
