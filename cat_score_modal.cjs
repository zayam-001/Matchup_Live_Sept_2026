const fs = require('fs');
console.log(fs.readFileSync('components/AdminDashboard.tsx', 'utf8').split('\n').slice(140, 260).join('\n'));
