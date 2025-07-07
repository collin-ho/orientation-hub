const db = require('./db');

function dbRowToLesson(r){
  return {
    id: r.lesson_id,
    name: r.name,
    week: r.week,
    weekDay: r.weekDay,
    dayOffset: r.dayOffset,
    startTime: r.startTime || undefined,
    endTime: r.endTime || undefined,
    subject: r.subject || undefined,
    leads: r.leads ? JSON.parse(r.leads) : [],
    isActive: r.isActive === 1,
    clickup_task_id: r.clickup_task_id || null
  };
}
function lessonToDbParams(className,l){
  return {
    class_name: className,
    lesson_id: l.id,
    name: l.name,
    week: l.week,
    weekDay: l.weekDay,
    dayOffset: l.dayOffset,
    startTime: l.startTime || null,
    endTime: l.endTime || null,
    subject: l.subject || null,
    leads: JSON.stringify(l.leads || []),
    isActive: l.isActive === false ? 0 : 1,
    clickup_task_id: l.clickup_task_id || null
  };
}
function getLessons(className){
  const rows = db.prepare('SELECT * FROM class_lessons WHERE class_name=? ORDER BY week, weekDay, dayOffset').all(className);
  return rows.map(dbRowToLesson);
}
function replaceLessons(className, lessons){
  const insert=db.prepare(`INSERT OR REPLACE INTO class_lessons (class_name, lesson_id, name, week, weekDay, dayOffset, startTime, endTime, subject, leads, isActive, clickup_task_id) VALUES (@class_name,@lesson_id,@name,@week,@weekDay,@dayOffset,@startTime,@endTime,@subject,@leads,@isActive,@clickup_task_id)`);
  const trx = db.transaction(ls=>{
    db.prepare('DELETE FROM class_lessons WHERE class_name=?').run(className);
    ls.forEach(l=>insert.run(lessonToDbParams(className,l)));
  });
  trx(lessons);
}
function copyFromTemplate(className){
  const lessons = db.prepare('SELECT * FROM lessons').all();
  replaceLessons(className, lessons.map(r=>({
    id:r.id,
    name:r.name,
    week:r.week,
    weekDay:r.weekDay,
    dayOffset:r.dayOffset,
    startTime:r.startTime,
    endTime:r.endTime,
    subject:r.subject,
    leads:r.leads?JSON.parse(r.leads):[],
    isActive:r.isActive,
    clickup_task_id:null
  })));
}
function setTaskId(className, lessonId, clickupId){
  db.prepare('UPDATE class_lessons SET clickup_task_id=? WHERE class_name=? AND lesson_id=?').run(clickupId, className, lessonId);
}
module.exports={getLessons, replaceLessons, copyFromTemplate, setTaskId}; 