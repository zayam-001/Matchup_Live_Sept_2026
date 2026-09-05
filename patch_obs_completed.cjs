const fs = require('fs');
const path = 'components/OBSOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

// I declared `const [isCompleted, setIsCompleted] = useState(false);` earlier.
content = content.replace(
  'const [isCompleted, setIsCompleted] = useState(false);',
  ''
);

fs.writeFileSync(path, content);
console.log("Fixed OBSOverlay.tsx isCompleted");
