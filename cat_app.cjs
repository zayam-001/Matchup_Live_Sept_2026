const fs = require('fs');
const contents = fs.readFileSync('App.tsx', 'utf8');
const routes = contents.split('\n').filter(l => l.includes('case ') || l.includes('switch'));
console.log(routes.join('\n'));
