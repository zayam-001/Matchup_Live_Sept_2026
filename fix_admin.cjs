const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const helper = `
const isTeamInCategory = (t: any, targetCategoryId: string | null, tournament: any) => {
    if (!targetCategoryId) return true;
    if (t.categoryId === targetCategoryId) return true;
    const category = tournament.categories?.find((c: any) => c.id === targetCategoryId);
    if (category && typeof t.categoryId === 'string' && t.categoryId.toLowerCase().trim() === category.name.toLowerCase().trim()) return true;
    return false;
};
`;

// Insert the helper after the imports
const importEndIndex = code.lastIndexOf("import");
const insertIndex = code.indexOf('\n', importEndIndex) + 1;
code = code.substring(0, insertIndex) + helper + code.substring(insertIndex);

// Replace the filters
code = code.replace(/\(!categoryId \|\| t\.categoryId === categoryId\)/g, "isTeamInCategory(t, categoryId, tournament)");
code = code.replace(/\(!targetCatId \|\| t\.categoryId === targetCatId\)/g, "isTeamInCategory(t, targetCatId, tournament)");

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log("Done");
