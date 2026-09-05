const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });

  await page.goto('http://localhost:3000/#obs/pdo4ZnpIwOrSBQABR9Zh/m_1785578876976_13', { waitUntil: 'networkidle2' });
  
  // Wait a bit to see if error boundary shows
  await page.waitForTimeout(3000);
  
  const bodyHandle = await page.$('body');
  const html = await page.evaluate(body => body.innerHTML, bodyHandle);
  
  // Try to find the pre tag with stack trace
  const stack = await page.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? pre.innerText : 'No pre tag found';
  });
  
  console.log('STACK TRACE:', stack);
  
  await browser.close();
})();
