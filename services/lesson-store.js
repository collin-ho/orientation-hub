const db = require('./db');

function dbRowToLesson(r) {
  return {
    id: r.id,
    name: r.name,
    week: r.week,
    weekDay: r.weekDay,
    dayOffset: r.dayOffset,
    startTime: r.startTime || undefined,
    endTime: r.endTime || undefined,
    subject: r.subject || undefined,
    leads: r.leads ? JSON.parse(r.leads) : [],
    isActive: r.isActive === 1,
  };
}

function lessonToDbParams(l) {
  return {
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
  };
}

function getAllLessons() {
  const rows = db.prepare('SELECT * FROM lessons ORDER BY week, weekDay, dayOffset').all();
  return rows.map(dbRowToLesson);
}

function replaceAllLessons(lessons) {
  const insert = db.prepare(`INSERT OR REPLACE INTO lessons (id, name, week, weekDay, dayOffset, startTime, endTime, subject, leads, isActive) VALUES (@id, @name, @week, @weekDay, @dayOffset, @startTime, @endTime, @subject, @leads, @isActive)`);
  const trx = db.transaction((ls) => {
    db.prepare('DELETE FROM lessons').run();
    ls.forEach((l) => insert.run(lessonToDbParams(l)));
  });
  trx(lessons);
}

function setTaskId(lessonId, clickupId) {
  db.prepare('UPDATE lessons SET clickup_task_id=? WHERE id=?').run(clickupId, lessonId);
}

module.exports = { getAllLessons, replaceAllLessons, setTaskId }; 