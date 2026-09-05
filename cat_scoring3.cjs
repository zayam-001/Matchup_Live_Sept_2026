const fs = require('fs');
console.log(fs.readFileSync('components/RefereeInterface.tsx', 'utf8').split('\n').slice(640, 680).join('\n'));
