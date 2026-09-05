const fs = require('fs');
let content = fs.readFileSync('components/StandingsOverlayExporter.tsx', 'utf8');
content = content.replace(/index === 0\s*\?\s*'bg-yellow-500 text-black'\s*:\s*index === 1\s*\?\s*'bg-slate-300 text-black'\s*:\s*index === 2\s*\?\s*'bg-orange-600 text-white'\s*\?\s*'bg-slate-300 text-black'\s*:\s*'bg-white\/10 text-white'/g, 
"index === 0 ? 'bg-[#FFD700] text-[#8B6508] shadow-[0_0_10px_rgba(255,215,0,0.5)]' : index === 1 ? 'bg-[#C0C0C0] text-[#4A4A4A] shadow-[0_0_10px_rgba(192,192,192,0.4)]' : index === 2 ? 'bg-[#CD7F32] text-[#5C3A16] shadow-[0_0_10px_rgba(205,127,50,0.4)]' : 'bg-white/10 text-white'");
fs.writeFileSync('components/StandingsOverlayExporter.tsx', content);
