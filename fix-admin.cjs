const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const targetTableStart = `<table className="w-full text-sm text-left min-w-[600px]">
                                    <thead className="text-content-secondary text-xs uppercase tracking-wider">
                                        {isAmericano ? (
                                            <tr>
                                                <th className="px-6 py-3 font-bold">Player</th>
                                                <th className="px-6 py-3 font-bold text-center">Played</th>
                                                <th className="px-6 py-3 font-bold text-center text-accent-success">W</th>
                                                <th className="px-6 py-3 font-bold text-center text-accent-error">L</th>
                                                <th className="px-6 py-3 font-bold text-center">GW</th>
                                                <th className="px-6 py-3 font-bold text-center">GL</th>
                                                <th className="px-6 py-3 font-bold text-center">GWP</th>
                                                <th className="px-6 py-3 font-bold text-center text-brand">Pts</th>
                                            </tr>`;

const replacementTableStart = `<table className="w-full text-sm text-left">
                                    <thead className="text-content-secondary text-xs uppercase tracking-wider">
                                        {isAmericano ? (
                                            <tr>
                                                <th className="px-2 py-3 font-bold">Player</th>
                                                <th className="px-1 py-3 font-bold text-center" title="Played">P</th>
                                                <th className="px-1 py-3 font-bold text-center text-accent-success" title="Wins">W</th>
                                                <th className="px-1 py-3 font-bold text-center text-accent-error" title="Losses">L</th>
                                                <th className="px-1 py-3 font-bold text-center" title="Games Won">GW</th>
                                                <th className="px-1 py-3 font-bold text-center" title="Games Lost">GL</th>
                                                <th className="px-1 py-3 font-bold text-center text-brand" title="Points">Pts</th>
                                            </tr>`;

code = code.replace(targetTableStart, replacementTableStart);


const targetTableCols = `                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4 text-center text-accent-success font-bold">{t.wins || 0}</td>
                                                        <td className="px-6 py-4 text-center text-accent-error font-bold">{t.losses || 0}</td>
                                                        <td className="px-6 py-4 text-center text-content-secondary">{t.gamesWon || 0}</td>
                                                        <td className="px-6 py-4 text-center text-content-secondary">{t.gamesLost || 0}</td>
                                                        <td className="px-6 py-4 text-center font-mono">{(t.gwp || 0).toFixed(1)}%</td>
                                                        <td className="px-6 py-4 text-center font-black text-brand text-lg">{t.points || 0}</td>
                                                    </>
                                                )}`;

const replacementTableCols = `                                                ) : (
                                                    <>
                                                        <td className="px-1 py-4 text-center text-accent-success font-bold">{t.wins || 0}</td>
                                                        <td className="px-1 py-4 text-center text-accent-error font-bold">{t.losses || 0}</td>
                                                        <td className="px-1 py-4 text-center text-content-secondary">{t.gamesWon || 0}</td>
                                                        <td className="px-1 py-4 text-center text-content-secondary">{t.gamesLost || 0}</td>
                                                        <td className="px-1 py-4 text-center font-black text-brand text-base">{t.points || 0}</td>
                                                    </>
                                                )}`;

code = code.replace(targetTableCols, replacementTableCols);

// Replace the name column px
code = code.replace(/<td className="px-6 py-4">\\s*<div className="flex items-center gap-3">/g, '<td className="px-2 py-4">\n                                                        <div className="flex items-center gap-2">');

code = code.replace(/<td className="px-6 py-4 text-center font-bold">\{t\.matchesPlayed \|\| 0\}<\/td>/g, '<td className="px-1 py-4 text-center font-bold">{t.matchesPlayed || 0}</td>');

// Also remove overflow-x-auto from the parent div if possible, or just let it be.
code = code.replace(/<div className="w-full overflow-x-auto mt-2">/, '<div className="w-full mt-2">');

fs.writeFileSync('components/AdminDashboard.tsx', code);
