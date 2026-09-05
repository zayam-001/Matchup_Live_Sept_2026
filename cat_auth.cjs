const fs = require('fs');
console.log(fs.readFileSync('components/Auth.tsx', 'utf8').split('\n').slice(210, 240).join('\n'));
