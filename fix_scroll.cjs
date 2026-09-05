const fs = require('fs');
let code = fs.readFileSync('components/PublicLanding.tsx', 'utf8');

// Replace targetScroll initialization
code = code.replace(
  'let targetScroll = window.scrollY || 0;',
  `const getScrollTop = () => {
    const sc = document.getElementById('main-scroll-container');
    return sc ? sc.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
  };
  let targetScroll = getScrollTop();`
);

// Replace onScroll logic
code = code.replace(
  'targetScroll = window.scrollY || document.documentElement.scrollTop || 0;',
  'targetScroll = getScrollTop();'
);

// Replace restartRenderLoop initialization
code = code.replace(
  'renderedScroll = window.scrollY || 0;',
  'renderedScroll = getScrollTop();'
);

// Replace event listener attachment
code = code.replace(
  "window.addEventListener('scroll', onScroll, { passive: true });",
  `const scrollEl = document.getElementById('main-scroll-container') || window;
  scrollEl.addEventListener('scroll', onScroll, { passive: true });`
);

// Replace event listener detachment
code = code.replace(
  "window.removeEventListener('scroll', onScroll);",
  `const scrollEl = document.getElementById('main-scroll-container') || window;
      scrollEl.removeEventListener('scroll', onScroll);`
);

// Also maxScroll computation
code = code.replace(
  'const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewportHeight);',
  `const sc = document.getElementById('main-scroll-container');
    const scrollHeight = sc ? sc.scrollHeight : document.documentElement.scrollHeight;
    const maxScroll = Math.max(1, scrollHeight - viewportHeight);`
);

fs.writeFileSync('components/PublicLanding.tsx', code);
