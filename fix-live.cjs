const fs = require('fs');
let code = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8');

const targetTableStart = `<table className="w-full text-left font-mono min-w-max md:min-w-[700px]">`;
const replacementTableStart = `<table className="w-full text-left font-mono">`;
code = code.replace(targetTableStart, replacementTableStart);

const targetTH = `                                        {isAmericano ? (
                                            <>
                                                <th className="px-2 md:px-4 py-4 text-center">W</th>
                                                <th className="px-2 md:px-4 py-4 text-center">L</th>
                                                <th className="px-2 md:px-4 py-4 text-center">GW</th>
                                                <th className="px-2 md:px-4 py-4 text-center">GL</th>
                                                <th className="px-4 md:px-6 py-4 text-center">GWP</th>
                                                <th className="px-4 md:px-6 py-4 text-right text-[#4D78FF]">PTS</th>
                                            </>
                                        )`;

const replacementTH = `                                        {isAmericano ? (
                                            <>
                                                <th className="px-1 md:px-4 py-3 text-center" title="Wins">W</th>
                                                <th className="px-1 md:px-4 py-3 text-center" title="Losses">L</th>
                                                <th className="px-1 md:px-4 py-3 text-center" title="Games Won">GW</th>
                                                <th className="px-1 md:px-4 py-3 text-center" title="Games Lost">GL</th>
                                                <th className="px-1 md:px-6 py-3 text-right text-[#4D78FF]" title="Points">PTS</th>
                                            </>
                                        )`;

code = code.replace(targetTH, replacementTH);

// Replace the columns for Americano
const targetCols = `                                                <td className="px-2 md:px-4 py-4 text-center text-[#10B981] font-bold text-sm">
                                                    {s.wins || 0}
                                                </td>
                                                <td className="px-2 md:px-4 py-4 text-center text-[#EF4444] font-bold text-sm">
                                                    {s.losses || 0}
                                                </td>
                                                <td className="px-2 md:px-4 py-4 text-center text-[#8A9AB0] text-sm font-medium">
                                                    {s.gamesWon || 0}
                                                </td>
                                                <td className="px-2 md:px-4 py-4 text-center text-[#8A9AB0] text-sm font-medium">
                                                    {s.gamesLost || 0}
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-center text-white text-sm font-semibold">
                                                    {(s.gwp || 0).toFixed(1)}%
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-right text-[#4D78FF] font-black text-base md:text-lg">
                                                    {s.points || 0}
                                                </td>`;

const replacementCols = `                                                <td className="px-1 md:px-4 py-4 text-center text-[#10B981] font-bold text-sm md:text-base">
                                                    {s.wins || 0}
                                                </td>
                                                <td className="px-1 md:px-4 py-4 text-center text-[#EF4444] font-bold text-sm md:text-base">
                                                    {s.losses || 0}
                                                </td>
                                                <td className="px-1 md:px-4 py-4 text-center text-[#8A9AB0] text-sm md:text-base font-medium">
                                                    {s.gamesWon || 0}
                                                </td>
                                                <td className="px-1 md:px-4 py-4 text-center text-[#8A9AB0] text-sm md:text-base font-medium">
                                                    {s.gamesLost || 0}
                                                </td>
                                                <td className="px-1 md:px-6 py-4 text-right text-[#4D78FF] font-black text-base md:text-xl">
                                                    {s.points || 0}
                                                </td>`;

code = code.replace(targetCols, replacementCols);


// In case targetTH was different due to whitespace, let's also do a regex just in case
code = code.replace(/<th className="px-4 md:px-6 py-4 text-center">GWP<\/th>/g, '');
code = code.replace(/<td className="px-4 md:px-6 py-4 text-center text-white text-sm font-semibold">\s*\{\(s\.gwp \|\| 0\)\.toFixed\(1\)\}\%\s*<\/td>/g, '');
code = code.replace(/<td className="px-4 md:px-6 py-4 text-right text-\[#4D78FF\] font-black text-base md:text-lg">/g, '<td className="px-1 md:px-6 py-4 text-right text-[#4D78FF] font-black text-base md:text-xl">');

fs.writeFileSync('components/LiveScoreboard.tsx', code);
