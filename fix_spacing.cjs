const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'components/LiveScoreboard.tsx');
let data = fs.readFileSync(filePath, 'utf8');

data = data.replace(/className="w-8 sm:w-12 text-center/g, 'className="px-2 sm:px-4 text-center');
data = data.replace(/className="w-10 sm:w-12 text-center/g, 'className="px-2 sm:px-4 text-center');
data = data.replace(/className="w-10 sm:w-14 text-right/g, 'className="px-2 sm:px-4 text-right');

fs.writeFileSync(filePath, data, 'utf8');
console.log("Replaced fixed widths with responsive padding.");
