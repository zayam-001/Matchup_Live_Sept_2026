const fs = require('fs');
const path = 'components/OBSOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const prevSetsRef = useRef<{p1: number, p2: number}>({p1: 0, p2: 0});',
  'const prevSetsRef = useRef<Array<{p1: number, p2: number}>>([]);'
);

fs.writeFileSync(path, content);
console.log("Fixed prevSetsRef");
