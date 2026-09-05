const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// Fix the scrambled view render logic
code = code.replace(/\{view === 'RESULTS'.*?<ResultsTab.*?\/>\}/g, '');
code = code.replace(/\{view === 'LEADERBOARD'.*?<TournamentLeaderboardTab.*?\/>\}/g, '');

code = code.replace(
    /\{view === 'KNOCKOUT' && <KnockoutTab tournament=\{activeTournament\} categoryId=\{selectedCategoryId\} \/>\}/,
    `{view === 'KNOCKOUT' && <KnockoutTab tournament={activeTournament} categoryId={selectedCategoryId} />}\n          {view === 'RESULTS' && <ResultsTab tournament={activeTournament} categoryId={selectedCategoryId} />}\n          {view === 'LEADERBOARD' && <TournamentLeaderboardTab tournament={activeTournament} categoryId={selectedCategoryId} />}`
);

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log('Cleaned up AdminDashboard.tsx views');
