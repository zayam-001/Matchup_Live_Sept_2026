const fs = require('fs');
console.log(fs.readFileSync('services/storage.ts', 'utf8').split('\n').slice(1350, 1370).join('\n'));
