const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /export const addKnockoutMatch = async \(\.\.\.args: any\[\]\) => \{([^]+?)status: "SCHEDULED"\n\s*\};/m,
    (match, p1) => {
        return `export const addKnockoutMatch = async (...args: any[]) => {${p1}status: "SCHEDULED",\n            stage: "KNOCKOUT"\n        };`;
    }
);

content = content.replace(
  /const payload = {\n\s*id: 'm_' \+ Date\.now\(\) \+ Math\.random\(\)\.toString\(36\)\.substr\(2, 9\),\n\s*categoryId,\n\s*roundName,/g,
  `const payload = {
            id: 'm_' + Date.now() + Math.random().toString(36).substr(2, 9),
            categoryId,
            categoryName: categoryId === 'ALL' ? 'ALL' : undefined,
            roundName,`
);

fs.writeFileSync(path, content);
console.log("Fixed addKnockoutMatch");
