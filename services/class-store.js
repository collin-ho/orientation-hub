const db = require('./db');

function addClassMapping({className, folderId=null, scheduleListId}){
  db.prepare(`INSERT OR IGNORE INTO classes (class_name, folder_id, schedule_list_id) VALUES (?,?,?)`).run(className, folderId, scheduleListId);
}
function getClassByName(name){
  return db.prepare('SELECT * FROM classes WHERE class_name=?').get(name);
}
function getAllClasses(){
  return db.prepare('SELECT * FROM classes ORDER BY created_at DESC').all();
}
module.exports={addClassMapping,getClassByName,getAllClasses}; 