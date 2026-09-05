const fs = require('fs');
let code = fs.readFileSync('components/OBSOverlay.tsx', 'utf8');

const replacementEnd = `            </div>
          </div>
        </div>
      </div>
      )}

      {activeOverlay === 'team_vs_team' && (
          <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md z-50">
             <div className="text-center w-full max-w-4xl">
                 <h2 className="text-4xl font-black text-brand tracking-[0.2em] mb-4 uppercase">Matchup</h2>
                 <div className="flex items-center justify-between mt-12 bg-white/5 border border-white/10 rounded-3xl p-12">
                     <div className="flex-1 text-center">
                         <div className="text-5xl font-black text-white tracking-widest">{t1Name}</div>
                         <div className="text-xl text-content-muted mt-2 font-mono uppercase">Team 1</div>
                     </div>
                     <div className="text-3xl font-black text-white/40 italic px-8">VS</div>
                     <div className="flex-1 text-center">
                         <div className="text-5xl font-black text-white tracking-widest">{t2Name}</div>
                         <div className="text-xl text-content-muted mt-2 font-mono uppercase">Team 2</div>
                     </div>
                 </div>
             </div>
          </div>
      )}

      {activeOverlay === 'player_profiles' && (
          <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md z-50">
             <div className="w-full max-w-6xl">
                 <h2 className="text-3xl font-black text-center text-brand tracking-[0.2em] mb-8 uppercase">Player Profiles</h2>
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                     {[...(match?.team1PlayerNames?.split(' & ') || ['P1', 'P2']), ...(match?.team2PlayerNames?.split(' & ') || ['P3', 'P4'])].map((p, i) => (
                         <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center flex flex-col items-center">
                             <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
                             </div>
                             <div className="text-xl font-black text-white uppercase tracking-wider">{p.trim()}</div>
                             <div className="text-sm font-mono text-content-muted mt-2">Win %: 0.00</div>
                             <div className="text-xs font-bold text-brand uppercase mt-1">Category: Pro</div>
                         </div>
                     ))}
                 </div>
             </div>
          </div>
      )}

      {activeOverlay === 'winner_result' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-50 p-4">
             <div className="w-[450px] aspect-[9/20] bg-surface-ground border border-white/10 rounded-[40px] p-8 flex flex-col items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-brand/20 blur-[100px] pointer-events-none rounded-full scale-150"></div>
                 <h2 className="text-2xl font-black text-white tracking-[0.3em] uppercase mb-12 z-10 text-center">Final Result</h2>
                 
                 <div className="w-full space-y-6 z-10">
                     <div className={\`p-6 rounded-2xl border flex flex-col items-center \${match?.winnerTeamId === match?.team1Id ? 'bg-brand/20 border-brand' : 'bg-white/5 border-white/10'}\`}>
                         <span className="text-3xl font-black text-white text-center uppercase tracking-wider">{t1Name}</span>
                         {match?.winnerTeamId === match?.team1Id && <span className="text-sm text-brand font-bold uppercase mt-2">Winner</span>}
                     </div>
                     <div className="text-center font-black text-white/30 italic">VS</div>
                     <div className={\`p-6 rounded-2xl border flex flex-col items-center \${match?.winnerTeamId === match?.team2Id ? 'bg-brand/20 border-brand' : 'bg-white/5 border-white/10'}\`}>
                         <span className="text-3xl font-black text-white text-center uppercase tracking-wider">{t2Name}</span>
                         {match?.winnerTeamId === match?.team2Id && <span className="text-sm text-brand font-bold uppercase mt-2">Winner</span>}
                     </div>
                 </div>
                 
                 <div className="mt-12 flex gap-4 z-10 font-mono text-xl">
                    {mappedSets.map((s, i) => (
                        <div key={i} className="flex flex-col items-center bg-black/50 rounded-lg p-3 border border-white/5">
                            <span className={\`font-bold \${isWinningSet('team1', i) ? 'text-white' : 'text-content-muted'}\`}>{s.team1}</span>
                            <div className="w-4 h-[1px] bg-white/10 my-1"></div>
                            <span className={\`font-bold \${isWinningSet('team2', i) ? 'text-white' : 'text-content-muted'}\`}>{s.team2}</span>
                        </div>
                    ))}
                 </div>
             </div>
          </div>
      )}

    </div>
  );
}`;

code = code.replace(/            <\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/, replacementEnd);
fs.writeFileSync('components/OBSOverlay.tsx', code);
