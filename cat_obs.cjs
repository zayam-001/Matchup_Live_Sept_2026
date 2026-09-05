const fs = require('fs');
console.log(fs.readFileSync('components/OBSOverlay.tsx', 'utf8').split('\n').slice(160, 200).join('\n'));
