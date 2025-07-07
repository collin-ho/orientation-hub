const fs = require('fs');
const path = require('path');
const csvPath = path.join(__dirname, '..', 'templates', 'Offical-schedule-template.csv');
const jsonPath = path.join(__dirname, '..', 'config', 'lesson-templates.json');

// helper to parse time string from CSV Start Date column to HH:MM (24h)
function csvTimeToHHMM(dateStr) {
  const match = dateStr.match(/(\d{1,2}):(\d{2}):\d{2} (am|pm)/i);
  if (!match) return '';
  let hour = parseInt(match[1], 10);
  const min = match[2];
  const ampm = match[3].toLowerCase();
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return `${hour.toString().padStart(2,'0')}:${min}`;
}

// read CSV
const csv = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
// skip header line
csv.shift();

// map lesson name -> {start,end}
const timeMap = {};
for (const line of csv) {
  if(!line.trim()) continue;
  const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/); // naive CSV split
  const name = parts[1]?.replace(/^"|"$/g,'').trim();
  const startDate = parts[3]?.replace(/^"|"$/g,'');
  const endDate   = parts[4]?.replace(/^"|"$/g,'');
  if(name && startDate && endDate){
    timeMap[name] = {
      start: csvTimeToHHMM(startDate),
      end:   csvTimeToHHMM(endDate)
    };
  }
}

// load existing JSON
const data = JSON.parse(fs.readFileSync(jsonPath,'utf8'));
let updated = 0;
data.lessons.forEach(lesson=>{
  const times = timeMap[lesson.name];
  if(times){
    lesson.startTime = times.start;
    lesson.endTime = times.end;
    updated++;
  }
});
console.log(`Updated ${updated} lessons with times from CSV`);
fs.writeFileSync(jsonPath, JSON.stringify(data,null,2));
console.log('lesson-templates.json updated'); 