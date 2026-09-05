const fs = require('fs');
let content = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8');

const badCode = "</AnimatePresence> => {";
const goodCode = `</AnimatePresence>
            {flashOverlayTitle && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none p-4 bg-black/80 backdrop-blur-sm">
                    <span className="font-black text-white italic text-2xl z-10 text-center leading-tight">
                        {flashOverlayTitle}
                    </span>
                </div>
            )}
        </div>
    );
};

const MatchTimeline = ({ matches, teams }: { matches: any[]; teams: any[] }) => {`;

content = content.replace(badCode, goodCode);
fs.writeFileSync('components/LiveScoreboard.tsx', content, 'utf8');
console.log("Fixed syntax");
