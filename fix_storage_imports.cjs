const fs = require('fs');
let code = fs.readFileSync('services/storage.ts', 'utf8');

const prefix = code.substring(0, code.indexOf('import { firebaseConfig }'));
if (prefix.includes('advanceBracket')) {
    code = code.substring(code.indexOf('import { firebaseConfig }'));
    
    // Find where imports stop
    let insertPos = 0;
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('import') && !lines[i].startsWith('    ') && lines[i].trim() !== '' && !lines[i].startsWith('}') && !lines[i].startsWith('from ')) {
            // Probably end of imports
            if (lines[i-1] && lines[i-1].includes('from')) {
               insertPos = code.indexOf(lines[i]);
               break;
            } else if (lines[i].includes('export const')) {
               insertPos = code.indexOf(lines[i]);
               break;
            }
        }
    }
    
    code = code.substring(0, insertPos) + prefix + '\n' + code.substring(insertPos);
    fs.writeFileSync('services/storage.ts', code);
    console.log("Fixed it!");
}

