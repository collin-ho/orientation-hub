const path = require('path');
const fs = require('fs');
const db = require('../services/db');

const jsonPath = path.join(__dirname, '..', 'config', 'lesson-templates.json');
if (!fs.existsSync(jsonPath)) {
  console.error('lesson-templates.json not found');
  process.exit(1);
}

const template = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
if (!template.lessons || !Array.isArray(template.lessons)) {
  console.error('Invalid lesson template format');
  process.exit(1);
}

const insert = db.prepare(`INSERT OR REPLACE INTO lessons (id, name, week, weekDay, dayOffset, startTime, endTime, subject, leads, isActive) VALUES (@id, @name, @week, @weekDay, @dayOffset, @startTime, @endTime, @subject, @leads, @isActive)`);
const trx = db.transaction((lessons) => {
  db.prepare('DELETE FROM lessons').run();
  lessons.forEach((l) => {
    insert.run({
      id: l.id,
      name: l.name,
      week: l.week,
      weekDay: l.weekDay,
      dayOffset: l.dayOffset,
      startTime: l.startTime || null,
      endTime: l.endTime || null,
      subject: l.subject || null,
      leads: JSON.stringify(l.leads || []),
      isActive: l.isActive === false ? 0 : 1,
    });
  });
});

trx(template.lessons);
console.log(`Seeded ${template.lessons.length} lessons into SQLite -> data/orientation.db`); 