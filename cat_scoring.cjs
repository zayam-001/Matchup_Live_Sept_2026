const fs = require('fs');
console.log(fs.readFileSync('components/RefereeInterface.tsx', 'utf8').split('\n').slice(600, 1000).join('\n'));
