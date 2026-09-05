const fs = require('fs');
const path = 'components/OBSOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /const prevSetsRef = useRef<Array<\{p1: number, p2: number\}>>\(\[\]\);/,
    `const prevSetsRef = useRef<Array<{team1: number, team2: number, p1Pts: string, p2Pts: string}>>([]);`
);

fs.writeFileSync(path, content);
console.log("Fixed prevSetsRef");
