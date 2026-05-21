const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '..', 'src', 'frontend', 'src'));
console.log('Searching all files in frontend/src...');
files.forEach(filePath => {
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
});
