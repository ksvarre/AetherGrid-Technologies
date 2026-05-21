const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Starting screenshot capture script...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  // Determine port (either 5173 or 5174)
  let port = 5173;
  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { timeout: 5000, waitUntil: 'networkidle' });
  } catch (err) {
    console.warn('Failed to load on port 5173, trying port 5174...');
    port = 5174;
    await page.goto('http://localhost:5174', { timeout: 10000, waitUntil: 'networkidle' });
  }
  
  console.log(`Successfully connected to App on port ${port}!`);

  // Ensure docs/images directory exists
  const imagesDir = path.join(__dirname, '..', 'docs', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Handle onboarding overlay if present
  console.log('Checking for onboarding welcome screen...');
  try {
    const skipBtnSelector = '.onboarding-btn.skip';
    await page.waitForSelector(skipBtnSelector, { timeout: 3000 });
    console.log('Onboarding overlay detected. Clicking Skip Tour...');
    await page.click(skipBtnSelector);
    await page.waitForTimeout(1000); // wait for overlay fadeout
  } catch (err) {
    console.log('No onboarding welcome screen detected or timeout exceeded. Proceeding...');
  }

  // --- SCREENSHOT 1: GridTrace Core with Active Search & Provenance Drawer ---
  console.log('Preparing Search Console screenshot...');
  
  // Wait for search input
  const searchInputSelector = 'input[placeholder*="Ask AetherGrid"]';
  await page.waitForSelector(searchInputSelector);
  
  // Type query
  console.log('Typing query "MAE forecasting error"...');
  await page.fill(searchInputSelector, 'MAE forecasting error');
  await page.press(searchInputSelector, 'Enter');
  
  // Wait for results
  console.log('Waiting for search results...');
  await page.waitForTimeout(3000); // safety wait for NLP synthesis typing effect
  
  // Let's see if we can find a citation to click.
  console.log('Looking for citation element to click to open Provenance Drawer...');
  const citationSelector = '.citation-link, .citation-badge, .source-badge, .citation-card, .citation-ref';
  const citationExists = await page.$(citationSelector);
  if (citationExists) {
    console.log('Clicking citation to open Provenance Drawer...');
    await citationExists.click();
    await page.waitForTimeout(1000); // wait for drawer slide-in animation
  } else {
    console.log('No citation element found, proceeding with search results screen.');
  }

  // Take search console screenshot
  const searchScreenshotPath = path.join(imagesDir, 'gridtrace_core.png');
  await page.screenshot({ path: searchScreenshotPath });
  console.log(`Saved screenshot: ${searchScreenshotPath}`);

  // Close the drawer to unblock pointer events!
  if (citationExists) {
    console.log('Closing Provenance Drawer to unblock UI...');
    const closeBtn = await page.$('.drawer-close');
    if (closeBtn) {
      await closeBtn.click();
    } else {
      console.log('Close button not found, clicking overlay far-left...');
      const overlay = await page.$('.citation-drawer-overlay');
      if (overlay) await overlay.click({ position: { x: 10, y: 10 } });
    }
    await page.waitForTimeout(1000); // wait for drawer close animation
  }

  // --- SCREENSHOT 2: Audit Queue ---
  console.log('Preparing Audit Queue screenshot...');
  const auditBtn = page.getByRole('button', { name: 'Audit Queue' });
  await auditBtn.click();
  await page.waitForTimeout(1500); // wait for transitions & data fetch
  
  const auditScreenshotPath = path.join(imagesDir, 'audit_queue.png');
  await page.screenshot({ path: auditScreenshotPath });
  console.log(`Saved screenshot: ${auditScreenshotPath}`);

  // --- SCREENSHOT 3: AetherPulse Metrics ---
  console.log('Preparing AetherPulse Metrics screenshot...');
  const metricsBtn = page.getByRole('button', { name: 'AetherPulse Metrics' });
  await metricsBtn.click();
  await page.waitForTimeout(2000); // wait for transitions & SVG chart animations
  
  const metricsScreenshotPath = path.join(imagesDir, 'aetherpulse_analytics.png');
  await page.screenshot({ path: metricsScreenshotPath });
  console.log(`Saved screenshot: ${metricsScreenshotPath}`);

  await browser.close();
  console.log('Screenshot capture finished successfully!');
}

run().catch(err => {
  console.error('Error running screenshot capture:', err);
  process.exit(1);
});
