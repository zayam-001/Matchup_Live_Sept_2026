const { build } = require('esbuild');
build({
  entryPoints: ['components/OBSOverlay.tsx'],
  bundle: true,
  outfile: 'out.js',
  external: ['react', 'react-dom', 'firebase/firestore', 'gsap']
}).catch(() => process.exit(1));
