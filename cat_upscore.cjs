const fs = require('fs');
console.log(fs.readFileSync('services/storage.ts', 'utf8').split('\n').slice(2340, 2370).join('\n'));
