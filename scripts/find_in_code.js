const fs = require('fs');
const path = require('path');

const files = [
  'src/frontend/src/App.tsx',
  'src/frontend/src/components/SearchConsole.tsx',
  'src/frontend/src/components/AuditQueue.tsx',
  'src/frontend/src/components/AetherPulseAnalytics.tsx',
  'src/frontend/src/components/CloudSettingsPanel.tsx',
  'src/frontend/src/components/SuggestedRoutingPanel.tsx'
];

files.forEach(f => {
  const filePath = path.join(__dirname, '..', f);
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.toLowerCase().includes('onboard') || content.toLowerCase().includes('welcome') || content.toLowerCase().includes('tour')) {
    console.log(`MATCH IN ${f}:`);
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes('onboard') || line.toLowerCase().includes('welcome') || line.toLowerCase().includes('tour')) {
        console.log(`  Line ${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
