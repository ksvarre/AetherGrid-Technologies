const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  
  const bodyHtml = await page.evaluate(() => document.body.innerHTML);
  console.log('--- BODY DOM CONTENT ---');
  console.log(bodyHtml);
  console.log('--- END BODY DOM CONTENT ---');
  
  await browser.close();
}

run().catch(console.error);
