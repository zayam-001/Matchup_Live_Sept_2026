const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });

  await page.goto('http://localhost:3000/#obs/pdo4ZnpIwOrSBQABR9Zh/m_1785578876976_13', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ path: 'obs_screenshot.png' });
  console.log('Screenshot saved to obs_screenshot.png');
  
  const html = await page.evaluate(() => document.body.innerHTML);
  if (html.includes('SOMETHING WENT WRONG')) {
      console.log("Error Boundary is still visible!");
  } else {
      console.log("No error boundary detected in HTML.");
  }
  
  await browser.close();
})();
