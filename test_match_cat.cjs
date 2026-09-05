const fs = require('fs');
const path = 'services/storage.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /const mCatId = m\.categoryId \? String\(m\.categoryId\) : '';/,
  `const mCatId = m.categoryId === 'ALL' ? '' : (m.categoryId ? String(m.categoryId) : '');`
);

content = content.replace(
  /const mCatName = m\.categoryName \? String\(m\.categoryName\)\.toLowerCase\(\)\.trim\(\) : \(m\.category \? String\(m\.category\)\.toLowerCase\(\)\.trim\(\) : ''\);/,
  `const mCatName = (m.categoryName === 'ALL' || m.category === 'ALL') ? '' : (m.categoryName ? String(m.categoryName).toLowerCase().trim() : (m.category ? String(m.category).toLowerCase().trim() : ''));`
);

fs.writeFileSync(path, content);
console.log("Fixed isMatchInCategory ALL bug");
