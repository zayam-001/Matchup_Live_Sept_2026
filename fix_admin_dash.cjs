const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// 1. Update state
code = code.replace(
  /const \[view, setView\] = useState<.*?>\('OVERVIEW'\);/,
  "const [view, setView] = useState<'OVERVIEW' | 'TEAMS' | 'GROUPS' | 'SCHEDULE' | 'KNOCKOUT' | 'STANDINGS' | 'RESULTS' | 'LEADERBOARD'>('OVERVIEW');"
);

// 2. Add TabButton
code = code.replace(
  /<TabButton active=\{view === 'RESULTS'\} onClick=\{\(\) => setView\('RESULTS'\)\} label="Results" icon=\{<Check size=\{16\}\/>\} \/>/,
  `<TabButton active={view === 'RESULTS'} onClick={() => setView('RESULTS')} label="Results" icon={<Check size={16}/>} />\n              <TabButton active={view === 'LEADERBOARD'} onClick={() => setView('LEADERBOARD')} label="Leaderboard" icon={<Medal size={16}/>} />`
);

// 3. Add view render
code = code.replace(
  /\{view === 'RESULTS' && <ResultsTab tournament=\{activeTournament\} categoryId=\{selectedCategoryId\} \/>\}/,
  `{view === 'RESULTS' && <ResultsTab tournament={activeTournament} categoryId={selectedCategoryId} />}\n          {view === 'LEADERBOARD' && <TournamentLeaderboardTab tournament={activeTournament} categoryId={selectedCategoryId} />}`
);

// 4. Add import
if (!code.includes('TournamentLeaderboardTab')) {
    code = code.replace(
      /import \{ ReplaceTeamModal \} from '\.\/ReplaceTeamModal';/,
      `import { ReplaceTeamModal } from './ReplaceTeamModal';\nimport { TournamentLeaderboardTab } from './TournamentLeaderboardTab';`
    );
}

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log('Fixed AdminDashboard.tsx');
