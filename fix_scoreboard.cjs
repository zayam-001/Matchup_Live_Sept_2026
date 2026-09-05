const fs = require('fs');
let content = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8');

const replacement = `{i === 0 ? ( <span className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 bg-[#FFD700] text-[#8B6508] shadow-[0_0_10px_rgba(255,215,0,0.5)]">{i + 1}</span> ) : i === 1 ? ( <span className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 bg-[#C0C0C0] text-[#4A4A4A] shadow-[0_0_10px_rgba(192,192,192,0.4)]">{i + 1}</span> ) : i === 2 ? ( <span className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 bg-[#CD7F32] text-[#5C3A16] shadow-[0_0_10px_rgba(205,127,50,0.4)]">{i + 1}</span> ) : ( <span className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 bg-white/10 text-gray-400">{i + 1}</span> )}`;

// Replace lines 1143 to 1151
const lines = content.split('\n');
const newLines = [
    ...lines.slice(0, 1142),
    replacement,
    ...lines.slice(1151)
];

fs.writeFileSync('components/LiveScoreboard.tsx', newLines.join('\n'));
