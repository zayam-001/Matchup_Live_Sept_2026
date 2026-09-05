const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const lines = code.split('\n');

// Find tab buttons block
let inTabs = false;
let newLines = [];
for (let i=0; i<lines.length; i++) {
    const line = lines[i];
    if (line.includes('view === \'KNOCKOUT\'') && line.includes('TabButton')) {
        newLines.push(line);
        newLines.push('              <TabButton active={view === \'RESULTS\'} onClick={() => setView(\'RESULTS\')} label="Results" icon={<Check size={16}/>} />');
        newLines.push('              <TabButton active={view === \'LEADERBOARD\'} onClick={() => setView(\'LEADERBOARD\')} label="Leaderboard" icon={<Medal size={16}/>} />');
        continue;
    }
    if (line.includes('view === \'RESULTS\'') && line.includes('TabButton')) {
        continue; // skip messed up ones
    }
    if (line.includes('view === \'LEADERBOARD\'') && line.includes('TabButton')) {
        continue; // skip messed up ones
    }
    
    // For view renders
    if (line.includes('view === \'KNOCKOUT\'') && line.includes('<KnockoutTab')) {
        newLines.push(line);
        newLines.push('          {view === \'RESULTS\' && <ResultsTab tournament={activeTournament} categoryId={selectedCategoryId} />}');
        newLines.push('          {view === \'LEADERBOARD\' && <TournamentLeaderboardTab tournament={activeTournament} categoryId={selectedCategoryId} />}');
        continue;
    }
    if (line.includes('view === \'RESULTS\'') && line.includes('<ResultsTab')) {
        continue;
    }
    if (line.includes('view === \'LEADERBOARD\'') && line.includes('<TournamentLeaderboardTab')) {
        continue;
    }
    
    newLines.push(line);
}

fs.writeFileSync('components/AdminDashboard.tsx', newLines.join('\n'));
console.log('Cleaned up');
