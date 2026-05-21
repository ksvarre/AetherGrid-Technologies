const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'frontend', 'src', 'index.css');
const content = fs.readFileSync(filePath, 'utf8');
if (content.toLowerCase().includes('onboard') || content.toLowerCase().includes('welcome') || content.toLowerCase().includes('tour') || content.toLowerCase().includes('overlay')) {
  console.log('MATCH IN index.css:');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('onboard') || line.toLowerCase().includes('welcome') || line.toLowerCase().includes('tour') || line.toLowerCase().includes('overlay')) {
      console.log(`  Line ${idx + 1}: ${line.trim()}`);
    }
  });
}
