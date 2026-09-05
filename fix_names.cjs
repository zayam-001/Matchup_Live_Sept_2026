const fs = require('fs');
const path = 'components/LiveScoreboard.tsx';
let content = fs.readFileSync(path, 'utf8');

const newFunc = `    const getTeamNamesAndPlayers = (teamId?: string, fallbackTeamName?: string, fallbackPlayerNames?: string) => {
        const t = teams.find(team => team.id === teamId);
        
        let player1 = '';
        let player2 = '';
        let teamName = fallbackTeamName || 'TBD';

        if (t) {
            teamName = t.name || fallbackTeamName || 'TBD';
            if (t.player1?.name || t.player1?.fullName) {
                player1 = t.player1?.name || t.player1?.fullName;
                player2 = t.player2?.name || t.player2?.fullName || '';
            } else {
                if (t.name && t.name.includes(' / ')) {
                    const split = t.name.split(' / ');
                    player1 = split[0];
                    player2 = split[1];
                } else if (t.name) {
                    player1 = t.name;
                    player2 = '';
                } else {
                    player1 = 'TBD';
                }
            }
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
        
        if (teamName === 'TBD' && player1 !== 'TBD') {
            teamName = player2 ? \`\${player1.split(' ')[0]} & \${player2.split(' ')[0]}\` : player1;
        }
        
        return { teamName, player1: player1 || 'TBD', player2 };
    };`;

content = content.replace(
    /const getTeamNamesAndPlayers = \(teamId\?: string, fallbackTeamName\?: string, fallbackPlayerNames\?: string\) => \{[\s\S]*?return \{ teamName, player1: player1 \|\| 'TBD', player2 \};\n    \};/,
    newFunc
);

fs.writeFileSync(path, content);
console.log("Updated LiveScoreboard.tsx names");
