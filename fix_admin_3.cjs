const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const helperCode = `
const isTeamInCategory = (t: any, targetCategoryId: string | null, tournament: any) => {
    if (!targetCategoryId) return true;
    if (t.categoryId === targetCategoryId) return true;
    const category = tournament.categories?.find((c: any) => c.id === targetCategoryId);
    if (category && typeof t.categoryId === 'string' && t.categoryId.toLowerCase().trim() === category.name.toLowerCase().trim()) return true;
    return false;
};`;

code = code.replace(helperCode, ""); // remove it from the wrong place
code = code.replace(`export const DeleteMatchConfirmModal`, helperCode + `\nexport const DeleteMatchConfirmModal`);

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log("Done");
