const fs = require('fs');

const files = [
  'hooks/useMatchResult.ts',
  'hooks/useTournamentDoc.ts',
  'hooks/useTournamentMatches.ts',
  'hooks/useLiveMatch.ts',
  'components/LiveScoreboard.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace "const db = getFirestore();" with "import { db } from '../services/storage';" (or similar)
    if (file.includes('components/')) {
        content = content.replace(/const db = getFirestore\(\);/g, ''); // In LiveScoreboard, db is already imported at the top! Wait, let's check.
    } else {
        content = content.replace(/import \{.*?\} from 'firebase\/firestore';/, (match) => {
            return match; // We'll just append the import if missing
        });
        content = content.replace(/const db = getFirestore\(\);/g, `import { db } from '../services/storage';`);
    }
    
    fs.writeFileSync(file, content);
  }
}
