const fs = require('fs');
let content = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8');
content = content.replace("import { subscribeToTournaments", "import { db, subscribeToTournaments");
fs.writeFileSync('components/LiveScoreboard.tsx', content);
