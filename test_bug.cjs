const fs = require('fs');
const content = fs.readFileSync('components/AdminDashboard.tsx', 'utf-8');
const lines = content.split('\n');

let balance = 0;
let start = 288; // 0-indexed for 289
for (let i = start; i < lines.length; i++) {
  balance += (lines[i].match(/{/g) || []).length;
  balance -= (lines[i].match(/}/g) || []).length;
  if (balance === 0) {
    console.log("AdminDashboard ends at line", i + 1);
    break;
  }
}
