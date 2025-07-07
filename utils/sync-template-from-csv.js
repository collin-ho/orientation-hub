const fs = require('fs');
const path = require('path');

const csvFile = path.join(__dirname, '..', 'templates', 'Offical-schedule-template.csv');
const jsonFile = path.join(__dirname, '..', 'config', 'lesson-templates.json');

function parseCSVLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { // escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function hhmmFromDateStr(dateStr) {
  const m = dateStr.match(/(\d{1,2}):(\d{2}):\d{2}\s*(am|pm)/i);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toLowerCase();
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${h.toString().padStart(2,'0')}:${min}`;
}

function norm(str) {
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

// build map from CSV
const lines = fs.readFileSync(csvFile, 'utf8').split(/\r?\n/).filter(Boolean);
const header = lines.shift();
const nameIdx = 1;
const startIdx = 3;
const endIdx = 4;
const csvMap = new Map();
lines.forEach(line => {
  const cells = parseCSVLine(line);
  const name = cells[nameIdx]?.replace(/^"|"$/g, '').trim();
  const startDate = cells[startIdx]?.replace(/^"|"$/g, '').trim();
  const endDate = cells[endIdx]?.replace(/^"|"$/g, '').trim();
  if (name && startDate && endDate) {
    csvMap.set(norm(name), {
      start: hhmmFromDateStr(startDate),
      end: hhmmFromDateStr(endDate)
    });
  }
});

const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
let updated = 0, missingCsv = [];

for (const lesson of data.lessons) {
  const key = norm(lesson.name);
  if (csvMap.has(key)) {
    const t = csvMap.get(key);
    if (t.start && t.end) {
      lesson.startTime = t.start;
      lesson.endTime = t.end;
      updated++;
    }
    csvMap.delete(key);
  } else {
    missingCsv.push(lesson.name);
  }
}

fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
console.log(`Updated ${updated} lessons. JSON saved.`);
if (csvMap.size) {
  console.log(`CSV rows not matched to JSON (${csvMap.size}):`);
  console.log(Array.from(csvMap.keys()).slice(0,10).join('\n')); // show first 10 unmatched
}
if (missingCsv.length) {
  console.log(`JSON lessons not found in CSV (${missingCsv.length})`);
  console.log(missingCsv.slice(0,10).join('\n'));
} 