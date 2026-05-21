try {
  const playwright = require('playwright');
  console.log('playwright is installed!');
} catch (e) {
  console.log('playwright is NOT installed in root:', e.message);
}
try {
  const playwright = require('playwright-core');
  console.log('playwright-core is installed!');
} catch (e) {
  console.log('playwright-core is NOT installed in root:', e.message);
}
