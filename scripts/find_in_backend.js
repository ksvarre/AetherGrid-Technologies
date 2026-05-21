const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules')) {
        results = results.concat(walk(file));
      }
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '..', 'src', 'backend'));
console.log('Searching all files in backend...');
files.forEach(filePath => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.toLowerCase().includes('onboarding') || content.toLowerCase().includes('welcome')) {
      console.log(`FOUND MATCH in: ${path.relative(path.join(__dirname, '..'), filePath)}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('onboarding') || line.toLowerCase().includes('welcome')) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
