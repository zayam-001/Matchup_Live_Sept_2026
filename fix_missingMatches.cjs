const fs = require('fs');
const path = 'components/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /const columns: \{ key: string, title: string, order: number, matches: Match\[\] \}\[\] = \[\];\n\s*if \(missingMatches\.length > 0\) \{\n\s*columns\.push\(\{ key: 'DEBUG', title: 'DEBUG MISSING', order: -1000, matches: missingMatches \}\);\n\s*\}\n\s*const columnMap/m,
    `const columns: { key: string, title: string, order: number, matches: Match[] }[] = [];
    const columnMap`
);

fs.writeFileSync(path, content);
console.log("Fixed missingMatches error");
