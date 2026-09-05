const fs = require('fs');

const fixFile = (file, badWord) => {
    let code = fs.readFileSync(file, 'utf8');
    const importRegex = new RegExp(`import\\s+\\{([^}]*?)\\b${badWord}\\b([^}]*?)\\}\\s+from\\s+['"]\\.\\.\/types['"];?`, 'g');
    code = code.replace(importRegex, (match, before, after) => {
        let newInside = (before + after).replace(/,\s*,/g, ',').replace(/^\s*,/, '').replace(/,\s*$/, '').trim();
        if (newInside === '') {
            return ''; // eliminate empty import entirely if possible, but actually we'll just remove the bad word
        }
        return `import { ${newInside} } from '../types';`;
    });
    fs.writeFileSync(file, code);
};

fixFile('components/BulkUploadTeamsModal.tsx', 'any');
fixFile('services/tournamentEngine.ts', 'string');

console.log("Imports fixed");
