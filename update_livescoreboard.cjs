const fs = require('fs');
const path = 'components/LiveScoreboard.tsx';
let content = fs.readFileSync(path, 'utf8');

const newFunc = `    const getTeamNamesAndPlayers = (teamId?: string, fallbackTeamName?: string, fallbackPlayerNames?: string) => {
        const t = teams.find(team => team.id === teamId);
        
        let player1 = '';
        let player2 = '';
        let teamName = fallbackTeamName || 'TBD';

        if (t) {
            player1 = t.player1?.name || t.player1?.fullName || 'Player 1';
            player2 = t.player2?.name || t.player2?.fullName || 'Player 2';
            teamName = t.name || fallbackTeamName || \`\${player1.split(' ')[0]} & \${player2.split(' ')[0]}\`;
        } else {
             if (fallbackPlayerNames) {
                 const split = fallbackPlayerNames.split(' / ');
                 if (split.length >= 2) {
                     player1 = split[0];
                     player2 = split[1];
                 } else {
                     player1 = fallbackPlayerNames;
                     player2 = '';
                 }
             } else if (fallbackTeamName) {
                 if (fallbackTeamName.includes(' / ')) {
                     const split = fallbackTeamName.split(' / ');
                     player1 = split[0];
                     player2 = split[1];
                 } else {
                     player1 = fallbackTeamName;
                     player2 = '';
                 }
             } else {
                 player1 = 'TBD';
             }
        }
        
        return { teamName, player1: player1 || 'TBD', player2 };
    };`;

content = content.replace(
    /const getTeamNamesAndPlayers = \(teamId\?: string\) => \{[\s\S]*?return \{ teamName, player1, player2 \};\n    \};/,
    newFunc
);

content = content.replace(/getTeamNamesAndPlayers\(m\.team1Id\)/g, "getTeamNamesAndPlayers(m.team1Id, m.team1Name, m.team1PlayerNames)");
content = content.replace(/getTeamNamesAndPlayers\(m\.team2Id\)/g, "getTeamNamesAndPlayers(m.team2Id, m.team2Name, m.team2PlayerNames)");
content = content.replace(/getTeamNamesAndPlayers\(activeModalMatch\.team1Id\)/g, "getTeamNamesAndPlayers(activeModalMatch.team1Id, activeModalMatch.team1Name, activeModalMatch.team1PlayerNames)");
content = content.replace(/getTeamNamesAndPlayers\(activeModalMatch\.team2Id\)/g, "getTeamNamesAndPlayers(activeModalMatch.team2Id, activeModalMatch.team2Name, activeModalMatch.team2PlayerNames)");
content = content.replace(/\(t1p2 && t1p2 !== 'Player 2'\)/g, "(t1p2 && t1p2 !== 'Player 2' && t1p2 !== 'TBD')");
content = content.replace(/\(t2p2 && t2p2 !== 'Player 2'\)/g, "(t2p2 && t2p2 !== 'Player 2' && t2p2 !== 'TBD')");

fs.writeFileSync(path, content);
console.log("Updated LiveScoreboard.tsx");
