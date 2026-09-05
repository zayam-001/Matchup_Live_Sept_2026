const fs = require('fs');
let code = fs.readFileSync('components/PublicLanding.css', 'utf8');

code = code.replace(/\/\* Modern Mobile Hamburger Toggle \*\/[\s\S]*?\/\* Fullscreen Mobile Menu \*\//, `/* Modern Mobile Hamburger Toggle */
.mobile-toggle-wrapper {
  display: none;
}
`);
code = code.replace(/\.mobile-toggle-btn \{ display: flex; \}/g, '.mobile-toggle-wrapper { display: block; }');
fs.writeFileSync('components/PublicLanding.css', code);
