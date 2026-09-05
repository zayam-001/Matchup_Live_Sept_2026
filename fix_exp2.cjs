const fs = require('fs');
let content = fs.readFileSync('components/StandingsOverlayExporter.tsx', 'utf8');

const regex = /<span className=\{\`h-5 w-5 rounded-full flex items-center justify-center text-\[10px\] font-black \$\{\s*index === 0\s*\?\s*'bg-yellow-500 text-black'\s*:\s*index === 1\s*\?\s*'bg-slate-300 text-black'\s*:\s*'bg-white\/10 text-white'\s*\}\`\}\>(\s*\{index \+ 1\}\s*)<\/span>/g;

const replacement = `{index === 0 ? (
    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black bg-[#FFD700] text-[#8B6508] shadow-[0_0_10px_rgba(255,215,0,0.5)]">{index + 1}</span>
) : index === 1 ? (
    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black bg-[#C0C0C0] text-[#4A4A4A] shadow-[0_0_10px_rgba(192,192,192,0.4)]">{index + 1}</span>
) : index === 2 ? (
    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black bg-[#CD7F32] text-[#5C3A16] shadow-[0_0_10px_rgba(205,127,50,0.4)]">{index + 1}</span>
) : (
    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black bg-white/10 text-white">{index + 1}</span>
)}`;

content = content.replace(regex, replacement);
fs.writeFileSync('components/StandingsOverlayExporter.tsx', content);
