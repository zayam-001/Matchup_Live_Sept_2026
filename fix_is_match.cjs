const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /if \(categories\.length === 1 && \(\!m\.categoryId && \!m\.categoryName && \!m\.category\)\) \{/,
  `// Infer category from team if missing
    if (!mCatId && !mCatName && m.team1Id && tournament?.teams) {
        const t1 = tournament.teams.find((t: any) => t.id === m.team1Id);
        if (t1 && t1.categoryId) {
            const inferredCatId = String(t1.categoryId);
            if (inferredCatId === targetId || inferredCatId === targetCategoryId || inferredCatId.toLowerCase().trim() === targetName) return true;
        }
    }
    
    if (categories.length === 1 && (!m.categoryId && !m.categoryName && !m.category)) {`
);

fs.writeFileSync(path, content);
console.log("Fixed isMatchInCategory");
