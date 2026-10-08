const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');
const main = fs.readFileSync('src/main.js', 'utf8');

const regex = /onclick=[\"\'](?:window\.)?([a-zA-Z0-9_]+)/g;
let match;
const handlers = new Set();
while ((match = regex.exec(html)) !== null) {
  handlers.add(match[1]);
}

console.log('Found', handlers.size, 'unique onclick handlers in index.html:');
const missing = [];
for (const h of handlers) {
  if (h === 'if') continue; // inline if statement
  const isBound = main.includes('window.' + h) || main.includes('window["' + h + '"]') || main.includes('function ' + h);
  if (!isBound) {
    missing.push(h);
  }
}

lines.forEach((line, idx) => {
  missing.forEach(m => {
    if (line.includes(m)) {
      console.log(`Line ${idx + 1} (${m}): ${line.trim()}`);
    }
  });
  if (line.includes('onclick="if') || line.includes("onclick='if")) {
    console.log(`Line ${idx + 1} (inline if): ${line.trim()}`);
  }
});

console.log('Missing handlers:', missing);
