const fs = require('fs');
const lines = fs.readFileSync('components/AdminDashboard.tsx', 'utf8').split('\n');

const cleaned = lines.filter(line => !line.includes('view === \'RESULTS\'') && !line.includes('view === \'LEADERBOARD\''));

// Now find where {view === 'KNOCKOUT'} is and insert correctly:
const idx = cleaned.findIndex(line => line.includes("{view === 'KNOCKOUT'"));
if (idx !== -1) {
    cleaned.splice(idx + 1, 0, 
        "          {view === 'RESULTS' && <ResultsTab tournament={activeTournament} categoryId={selectedCategoryId} />}",
        "          {view === 'LEADERBOARD' && <TournamentLeaderboardTab tournament={activeTournament} categoryId={selectedCategoryId} />}"
    );
}

// Ensure the TabButtons are correctly formatted (Wait, we removed the TabButtons if they included those words too!)
// Oh, the TabButtons include those words. 
