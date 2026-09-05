const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // Try evaluating some javascript on the page to see if it renders
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:3000/#landing', { waitUntil: 'networkidle2' });
  
  const hasAppRoot = await page.evaluate(() => document.querySelector('.min-h-screen') !== null);
  console.log('HAS APP ROOT:', hasAppRoot);
  
  await browser.close();
})();
